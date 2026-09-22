import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const COLORS = {
  bg: '#0A0B0E',
  card: '#16181D',
  primary: '#4A9EFF',
  text: '#FFFFFF',
  textMuted: '#8F94A0',
  border: '#2A2E39',
};

export default function Perfil() {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 8, paddingBottom: 90 }}>
        <Text style={styles.title}>Perfil</Text>
        <Text style={styles.subtitle}>Suas informações</Text>

        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>J</Text>
          </View>
          <Text style={styles.name}>João</Text>
          <Text style={styles.email}>usuario@sonifit.com</Text>
        </View>
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
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: { color: COLORS.bg, fontSize: 32, fontWeight: '900' },
  name: { color: COLORS.text, fontSize: 20, fontWeight: '700' },
  email: { color: COLORS.textMuted, fontSize: 14, marginTop: 4 },
});