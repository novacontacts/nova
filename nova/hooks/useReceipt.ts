// hooks/useReceipt.ts
// Laddar upp/raderar kvitto till Supabase Storage och kopplar via expenses.receipt_path.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store/auth';

const BUCKET = 'receipts';

function extFromUri(uri: string): 'jpg' | 'png' | 'heic' {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'png';
  if (lower.endsWith('.heic')) return 'heic';
  return 'jpg';
}

/** Hämtar en signed URL (1h) för ett kvitto. */
export function useReceiptUrl(receiptPath: string | null | undefined) {
  return useQuery({
    queryKey: ['receipt-url', receiptPath],
    enabled: !!receiptPath,
    staleTime: 50 * 60 * 1000, // 50 min — strax under signed-URL TTL
    queryFn: async () => {
      if (!receiptPath) return null;
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(receiptPath, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

type UploadInput = {
  expenseId: string;
  localUri: string;
};

export function useUploadReceipt() {
  const qc = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async ({ expenseId, localUri }: UploadInput) => {
      if (!user) throw new Error('Inte inloggad');

      // 1. Läs filen som base64 → ArrayBuffer
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const buffer = decodeBase64(base64);
      const ext = extFromUri(localUri);
      const path = `${user.id}/${expenseId}/${Date.now()}.${ext}`;
      const contentType =
        ext === 'png' ? 'image/png' : ext === 'heic' ? 'image/heic' : 'image/jpeg';

      // 2. Ladda upp
      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, buffer, { contentType, upsert: true });
      if (uploadErr) throw uploadErr;

      // 3. Koppla till expense-raden (och radera ev. tidigare kvitto)
      const { data: existing } = await supabase
        .from('expenses')
        .select('receipt_path')
        .eq('id', expenseId)
        .single();

      if (existing?.receipt_path && existing.receipt_path !== path) {
        await supabase.storage.from(BUCKET).remove([existing.receipt_path]);
      }

      const { error: updateErr } = await supabase
        .from('expenses')
        .update({ receipt_path: path })
        .eq('id', expenseId);
      if (updateErr) throw updateErr;

      return path;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['expense'] });
    },
  });
}

export function useDeleteReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ expenseId, path }: { expenseId: string; path: string }) => {
      const { error: delErr } = await supabase.storage.from(BUCKET).remove([path]);
      if (delErr) throw delErr;
      const { error: updErr } = await supabase
        .from('expenses')
        .update({ receipt_path: null })
        .eq('id', expenseId);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['expense'] });
    },
  });
}
