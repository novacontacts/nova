import { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, PanResponder } from 'react-native';
import { colors, typography, spacing } from '@/constants/theme';

interface Props {
  value: number;
  onChange: (v: number) => void;
  amount: number;
  myName?: string;
  partnerName?: string;
}

const THUMB = 28;

export function SplitSlider({ value, onChange, amount, myName = 'Du', partnerName = 'Partner' }: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);
  const valueRef = useRef(value);
  const startPctRef = useRef(value);

  useEffect(() => { valueRef.current = value; }, [value]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderGrant: () => { startPctRef.current = valueRef.current; },
      onPanResponderMove: (_, gs) => {
        if (trackWidthRef.current === 0) return;
        const delta = (gs.dx / trackWidthRef.current) * 100;
        onChange(Math.round(Math.min(100, Math.max(0, startPctRef.current + delta))));
      },
    })
  ).current;

  const pct = Math.min(100, Math.max(0, value));
  const thumbLeft = trackWidth > 0 ? (trackWidth * pct / 100) - THUMB / 2 : 0;
  const myAmt = amount > 0 ? Math.round(amount * pct / 100) : null;
  const partnerAmt = amount > 0 ? Math.round(amount * (100 - pct) / 100) : null;

  return (
    <View style={styles.container}>
      <View
        style={styles.trackWrap}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          setTrackWidth(w);
          trackWidthRef.current = w;
        }}
        {...panResponder.panHandlers}
      >
        <View style={styles.bar}>
          <View style={{ flex: pct || 0.001, backgroundColor: colors.accentFrom, borderRadius: 4 }} />
          <View style={{ flex: (100 - pct) || 0.001, backgroundColor: colors.border, borderRadius: 4 }} />
        </View>
        {trackWidth > 0 && <View style={[styles.thumb, { left: thumbLeft }]} />}
      </View>

      <View style={styles.labels}>
        <View>
          <Text style={styles.name}>{myName}</Text>
          <Text style={styles.pct}>{pct}%</Text>
          {myAmt != null && <Text style={styles.amt}>{myAmt} kr</Text>}
        </View>
        <View style={styles.rightLabel}>
          <Text style={[styles.name, styles.right]}>{partnerName}</Text>
          <Text style={[styles.pct, styles.right]}>{100 - pct}%</Text>
          {partnerAmt != null && <Text style={[styles.amt, styles.right]}>{partnerAmt} kr</Text>}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  trackWrap: {
    height: THUMB + 16,
    justifyContent: 'center',
    position: 'relative',
  },
  bar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.textPrimary,
    top: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  rightLabel: { alignItems: 'flex-end' },
  name: { fontSize: typography.sm, color: colors.textSecondary, fontWeight: '500' },
  pct: { fontSize: typography.xl, fontWeight: '700', color: colors.textPrimary },
  amt: { fontSize: typography.sm, color: colors.textSecondary },
  right: { textAlign: 'right' },
});
