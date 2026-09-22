import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const COLORS = {
  bg: '#0A0B0E',
  card: '#16181D',
  primary: '#4A9EFF',
  text: '#FFFFFF',
  textMuted: '#8F94A0',
  border: '#2A2E39',
};

export default function Corrida() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 8, paddingBottom: 90 }}>
        <Text style={styles.title}>Corrida</Text>
        <Text style={styles.subtitle}>Escolha um modo e comece</Text>

        <TouchableOpacity 
          style={styles.card}
          onPress={() => router.push('/runSetup')}
        >
          <Ionicons name="walk" size={48} color={COLORS.primary} />
          <Text style={styles.cardTitle}>Correr agora</Text>
          <Text style={styles.cardSubtitle}>Por meta ou modo livre</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  title: { color: COLORS.text, fontSize: 26, fontWeight: 'bold' },
  subtitle: { color: COLORS.textMuted, fontSize: 14, marginTop: 4, marginBottom: 20 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700', marginTop: 12 },
  cardSubtitle: { color: COLORS.textMuted, fontSize: 13, marginTop: 4 },
});