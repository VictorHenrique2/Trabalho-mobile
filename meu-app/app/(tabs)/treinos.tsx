import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const COLORS = {
  bg: '#0A0B0E',
  card: '#16181D',
  primary: '#4A9EFF',
  text: '#FFFFFF',
  textMuted: '#8F94A0',
  border: '#2A2E39',
  successBg: '#1C3119',
  successBorder: '#2E5A27',
  successText: '#6BFF7F',
};

// Lista de treinos disponíveis
const TREINOS = [
  {
    id: '1',
    titulo: 'Treino de Pernas',
    descricao: '6 exercícios • ~35 min',
    icone: 'run',
    nivel: 'Intermediário',
    exercicios: ['Agachamento', 'Leg Press', 'Cadeira Extensora', 'Stiff', 'Panturrilha', 'Afundo'],
  },
  {
    id: '2',
    titulo: 'Peito e Tríceps',
    descricao: '5 exercícios • ~40 min',
    icone: 'barbell',
    nivel: 'Intermediário',
    exercicios: ['Supino Reto', 'Supino Inclinado', 'Crucifixo', 'Tríceps Pulley', 'Tríceps Testa'],
  },
  {
    id: '3',
    titulo: 'Costas e Bíceps',
    descricao: '6 exercícios • ~45 min',
    icone: 'body',
    nivel: 'Avançado',
    exercicios: ['Puxada Frontal', 'Remada Curvada', 'Remada Baixa', 'Rosca Direta', 'Rosca Martelo', 'Rosca Scott'],
  },
  {
    id: '4',
    titulo: 'Cardio HIIT',
    descricao: '20 min intenso',
    icone: 'flash',
    nivel: 'Avançado',
    exercicios: ['Corrida', 'Burpee', 'Mountain Climber', 'Polichinelo', 'Pular Corda'],
  },
  {
    id: '5',
    titulo: 'Full Body',
    descricao: '8 exercícios • ~50 min',
    icone: 'fitness',
    nivel: 'Intermediário',
    exercicios: ['Agachamento', 'Flexão', 'Remada', 'Desenvolvimento', 'Prancha', 'Abdominal', 'Burpee', 'Elevação Pélvica'],
  },
];

export default function Treinos() {
  const insets = useSafeAreaInsets();
  const [treinosConcluidos, setTreinosConcluidos] = useState<string[]>([]);

  useEffect(() => {
    carregarTreinosConcluidos();
  }, []);

  const carregarTreinosConcluidos = async () => {
    try {
      const json = await AsyncStorage.getItem('@sonifit_treinos_concluidos');
      if (json) setTreinosConcluidos(JSON.parse(json));
    } catch {}
  };

  const iniciarTreino = async (treino: typeof TREINOS[0]) => {
    // Marca como concluído
    const novos = [...treinosConcluidos, treino.id];
    setTreinosConcluidos(novos);
    await AsyncStorage.setItem('@sonifit_treinos_concluidos', JSON.stringify(novos));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <ScrollView 
        contentContainerStyle={[
          styles.scroll, 
          { paddingTop: Math.max(insets.top + 8, 16), paddingBottom: 90 + insets.bottom }
        ]}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Treinos</Text>
            <Text style={styles.subtitle}>Escolha um treino e comece</Text>
          </View>
          <TouchableOpacity style={styles.filterBtn}>
            <Ionicons name="filter" size={22} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {/* Card de progresso */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Ionicons name="trophy" size={22} color={COLORS.primary} />
            <Text style={styles.progressTitle}>
              {treinosConcluidos.length} de {TREINOS.length} treinos
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${(treinosConcluidos.length / TREINOS.length) * 100}%` }
              ]} 
            />
          </View>
        </View>

        {/* Lista de treinos */}
        {TREINOS.map((treino) => {
          const concluido = treinosConcluidos.includes(treino.id);
          return (
            <TouchableOpacity
              key={treino.id}
              style={[styles.treinoCard, concluido && styles.treinoCardConcluido]}
              onPress={() => iniciarTreino(treino)}
            >
              <View style={styles.treinoIconContainer}>
                <MaterialCommunityIcons 
                  name={treino.icone as any} 
                  size={28} 
                  color={COLORS.primary} 
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.treinoTitle}>{treino.titulo}</Text>
                <Text style={styles.treinoDescricao}>{treino.descricao}</Text>
                <View style={styles.treinoNivel}>
                  <Text style={styles.treinoNivelText}>{treino.nivel}</Text>
                </View>
              </View>
              {concluido ? (
                <Ionicons name="checkmark-circle" size={28} color={COLORS.successText} />
              ) : (
                <Ionicons name="chevron-forward" size={24} color={COLORS.textMuted} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  title: { color: COLORS.text, fontSize: 26, fontWeight: 'bold' },
  subtitle: { color: COLORS.textMuted, fontSize: 14, marginTop: 4 },
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  progressCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  progressTitle: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  progressBar: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  treinoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  treinoCardConcluido: {
    borderColor: COLORS.successBorder,
    backgroundColor: COLORS.successBg,
  },
  treinoIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#1A1D24',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  treinoTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  treinoDescricao: { color: COLORS.textMuted, fontSize: 13, marginTop: 2 },
  treinoNivel: {
    alignSelf: 'flex-start',
    backgroundColor: '#1A1D24',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 6,
  },
  treinoNivelText: { color: COLORS.primary, fontSize: 11, fontWeight: '600' },
});