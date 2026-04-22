import { Redirect } from 'expo-router';

// Rotrutten redirectar direkt – auth-logiken bestämmer vart
export default function Index() {
  return <Redirect href="/(auth)/login" />;
}
