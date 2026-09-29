import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  TouchableOpacity,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

// ===== IMPORTAÇÃO CONDICIONAL DO MAPA =====
let MapView: any = null;
let Polyline: any = null;

if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Polyline = Maps.Polyline;
  } catch (e) {
    console.log('Mapa não disponível:', e);
  }
}

const COLORS = {
  bg: '#0A0B0E',
  card: '#16181D',
  primary: '#4A9EFF', // Azul
  primaryDark: '#3A7ECC',
  text: '#FFFFFF',
  textMuted: '#8F94A0',
  border: '#2A2E39',
  errorBg: '#3B181A',
  errorBorder: '#801A1D',
  errorText: '#FF6B6B',
  successBg: '#1C3119',
  successBorder: '#2E5A27',
  successText: '#6BFF7F',
};

const SESSION_KEY = '@sonifit_user_session';
const USERS_DB_KEY = '@sonifit_registered_users';
const STATS_KEY_PREFIX = '@sonifit_stats_';
const DAILY_STATS_KEY_PREFIX = '@sonifit_daily_stats_';

const INITIAL_MOCK_USERS = [
  { nome: 'João', email: 'usuario@sonifit.com', password: '123456' },
];

const DEFAULT_STATS = {
  treinosRealizados: 0,
  corridasKm: 0,
  tempoTotalMinutos: 0,
  sequenciaAtual: 0,
};

const DEFAULT_DAILY_STATS = {
  kmHoje: 0,
  minutosHoje: 0,
  data: '',
};

const LOGO_IMAGE = require('../../assets/images/logo.png');
const SONIC_GIF = require('../../assets/images/sonic-dance.gif');

export default function App() {
  const insets = useSafeAreaInsets();

  const [currentScreen, setCurrentScreen] = useState<
    'splash' | 'login' | 'register' | 'home' | 'runSetup' | 'running' | 'runSummary'
  >('splash');

  // Login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [usuarioSalvo, setUsuarioSalvo] = useState<{ nome: string; email: string } | null>(null);
  const [loginMessage, setLoginMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [forcarLoginCompleto, setForcarLoginCompleto] = useState(false);

  // Cadastro
  const [regNome, setRegNome] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regDataNasc, setRegDataNasc] = useState('');
  const [regAltura, setRegAltura] = useState('');
  const [regPeso, setRegPeso] = useState('');
  const [regObjetivo, setRegObjetivo] = useState('');
  const [regMessage, setRegMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const [welcomeMessage, setWelcomeMessage] = useState<string | null>(null);
  const [userStats, setUserStats] = useState(DEFAULT_STATS);
  const [dailyStats, setDailyStats] = useState(DEFAULT_DAILY_STATS);

  // Corrida
  const [selectedKm, setSelectedKm] = useState<number | null>(null);
  const [runMode, setRunMode] = useState<'meta' | 'livre' | null>(null);
  const [targetKm, setTargetKm] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [runDistance, setRunDistance] = useState(0);
  const [runTime, setRunTime] = useState(0);
  const [runCoords, setRunCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [watchSubscription, setWatchSubscription] = useState<Location.LocationSubscription | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [aguardandoLocalizacao, setAguardandoLocalizacao] = useState(false);

  const [summaryData, setSummaryData] = useState({
    distancia: 0,
    tempo: '00:00',
    ritmo: '--:--',
    calorias: 0,
    metaAlcancada: false,
    metaKm: 0,
  });

  const [showCustomKmModal, setShowCustomKmModal] = useState(false);
  const [customKmInput, setCustomKmInput] = useState('');
  const [customKmError, setCustomKmError] = useState('');

  const getDataAtual = () => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  };

  useEffect(() => {
    carregarUsuarioSalvo();
  }, []);

  useEffect(() => {
    if (usuarioSalvo?.email) {
      carregarStatsUsuario(usuarioSalvo.email);
      carregarDailyStats(usuarioSalvo.email);
    } else {
      setUserStats(DEFAULT_STATS);
      setDailyStats(DEFAULT_DAILY_STATS);
    }
  }, [usuarioSalvo]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (usuarioSalvo?.email) verificarResetDiario(usuarioSalvo.email);
    }, 60000);
    return () => clearInterval(interval);
  }, [usuarioSalvo, dailyStats]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (watchSubscription) watchSubscription.remove();
    };
  }, [watchSubscription]);

  const exibirAlerta = (titulo: string, mensagem: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      window.alert(`${titulo}\n\n${mensagem}`);
      if (onOk) onOk();
    } else {
      Alert.alert(titulo, mensagem, [{ text: 'OK', onPress: () => onOk && onOk() }]);
    }
  };

  const obterTodosUsuarios = async () => {
    try {
      const storedUsersJson = await AsyncStorage.getItem(USERS_DB_KEY);
      const storedUsers = storedUsersJson ? JSON.parse(storedUsersJson) : [];
      return [...INITIAL_MOCK_USERS, ...storedUsers];
    } catch {
      return INITIAL_MOCK_USERS;
    }
  };

  const carregarUsuarioSalvo = async () => {
    try {
      const jsonValue = await AsyncStorage.getItem(SESSION_KEY);
      if (jsonValue != null) setUsuarioSalvo(JSON.parse(jsonValue));
    } catch {}
  };

  const salvarSessaoLocal = async (usuario: { nome: string; email: string }) => {
    try {
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(usuario));
      setUsuarioSalvo(usuario);
    } catch {}
  };

  const getStatsKey = (email: string) => `${STATS_KEY_PREFIX}${email.toLowerCase()}`;
  const getDailyStatsKey = (email: string) => `${DAILY_STATS_KEY_PREFIX}${email.toLowerCase()}`;

  const carregarStatsUsuario = async (email: string) => {
    try {
      const json = await AsyncStorage.getItem(getStatsKey(email));
      if (json) setUserStats(JSON.parse(json));
      else {
        setUserStats(DEFAULT_STATS);
        await AsyncStorage.setItem(getStatsKey(email), JSON.stringify(DEFAULT_STATS));
      }
    } catch {
      setUserStats(DEFAULT_STATS);
    }
  };

  const salvarStatsUsuario = async (email: string, stats: typeof DEFAULT_STATS) => {
    try {
      await AsyncStorage.setItem(getStatsKey(email), JSON.stringify(stats));
      setUserStats(stats);
    } catch {}
  };

  const carregarDailyStats = async (email: string) => {
    try {
      const json = await AsyncStorage.getItem(getDailyStatsKey(email));
      const dataAtual = getDataAtual();
      if (json) {
        const stats = JSON.parse(json);
        if (stats.data !== dataAtual) {
          const novos = { ...DEFAULT_DAILY_STATS, data: dataAtual };
          await AsyncStorage.setItem(getDailyStatsKey(email), JSON.stringify(novos));
          setDailyStats(novos);
        } else {
          setDailyStats(stats);
        }
      } else {
        const novos = { ...DEFAULT_DAILY_STATS, data: dataAtual };
        await AsyncStorage.setItem(getDailyStatsKey(email), JSON.stringify(novos));
        setDailyStats(novos);
      }
    } catch {
      setDailyStats({ ...DEFAULT_DAILY_STATS, data: getDataAtual() });
    }
  };

  const salvarDailyStats = async (email: string, stats: typeof DEFAULT_DAILY_STATS) => {
    try {
      await AsyncStorage.setItem(getDailyStatsKey(email), JSON.stringify(stats));
      setDailyStats(stats);
    } catch {}
  };

  const verificarResetDiario = async (email: string) => {
    const dataAtual = getDataAtual();
    if (dailyStats.data !== dataAtual) {
      await salvarDailyStats(email, { ...DEFAULT_DAILY_STATS, data: dataAtual });
    }
  };

  const atualizarDailyStats = async (email: string, km: number, minutos: number) => {
    const dataAtual = getDataAtual();
    if (dailyStats.data !== dataAtual) {
      await salvarDailyStats(email, { kmHoje: km, minutosHoje: minutos, data: dataAtual });
    } else {
      await salvarDailyStats(email, {
        ...dailyStats,
        kmHoje: +(dailyStats.kmHoje + km).toFixed(2),
        minutosHoje: dailyStats.minutosHoje + minutos,
      });
    }
  };

  const logoutUsuario = async () => {
    try {
      await AsyncStorage.removeItem(SESSION_KEY);
      setUsuarioSalvo(null);
      setWelcomeMessage(null);
      setUserStats(DEFAULT_STATS);
      setDailyStats(DEFAULT_DAILY_STATS);
      setForcarLoginCompleto(false);
      setEmail('');
      setPassword('');
      setLoginMessage(null);
      setCurrentScreen('login');
    } catch {}
  };

  const formatarTempo = (min: number) => {
    if (min === 0) return '0h 0min';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h ${m}min`;
  };

  const formatarKm = (km: number) => (km === 0 ? '0 km' : `${km.toFixed(1).replace('.', ',')} km`);
  const formatarKmHoje = (km: number) => (km === 0 ? '0,0 km' : `${km.toFixed(1).replace('.', ',')} km`);
  const formatarMinutosHoje = (min: number) => {
    if (min === 0) return '0min';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  };

  // ===== FUNÇÕES DA CORRIDA =====
  const calcularDistancia = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const formatarTempoCorrida = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const calcularRitmo = (metros: number, segundos: number) => {
    if (metros < 20) return '--:--';
    const minPorKm = segundos / 60 / (metros / 1000);
    const min = Math.floor(minPorKm);
    const seg = Math.round((minPorKm - min) * 60);
    return `${min}:${seg.toString().padStart(2, '0')}`;
  };

  const calcularCalorias = (metros: number, peso = 70) => Math.round((metros / 1000) * peso * 1.03);

  const pedirPermissaoLocalizacao = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      exibirAlerta('Localização necessária', 'Precisamos da sua localização para registrar a corrida e o mapa.');
      return false;
    }
    return true;
  };

  const iniciarTracking = async () => {
    setAguardandoLocalizacao(true);

    const ok = await pedirPermissaoLocalizacao();
    if (!ok) {
      setAguardandoLocalizacao(false);
      return;
    }

    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coord = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };

      setCurrentLocation(coord);
      setRunCoords([coord]);
      setRunDistance(0);
      setRunTime(0);
      setIsRunning(true);
      setIsPaused(false);
      setAguardandoLocalizacao(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 1500,
          distanceInterval: 2,
        },
        (newLoc) => {
          const newCoord = {
            latitude: newLoc.coords.latitude,
            longitude: newLoc.coords.longitude,
          };
          setCurrentLocation(newCoord);

          setRunCoords((prev) => {
            if (prev.length === 0) return [newCoord];
            const last = prev[prev.length - 1];
            const dist = calcularDistancia(
              last.latitude,
              last.longitude,
              newCoord.latitude,
              newCoord.longitude
            );

            if (dist > 1.5) {
              setRunDistance((d) => {
                const nova = d + dist;
                if (d === 0 && nova > 0 && !timerRef.current) {
                  timerRef.current = setInterval(() => {
                    setRunTime((t) => t + 1);
                  }, 1000);
                }
                return nova;
              });
              return [...prev, newCoord];
            }
            return prev;
          });
        }
      );
      setWatchSubscription(sub);
    } catch (e) {
      console.error(e);
      setAguardandoLocalizacao(false);
      exibirAlerta('Erro', 'Não foi possível obter a localização. Verifique se o GPS está ativo.');
    }
  };

  const togglePause = () => {
    if (isPaused) {
      setIsPaused(false);
      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          setRunTime((t) => t + 1);
        }, 1000);
      }
    } else {
      setIsPaused(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const limparDadosCorrida = () => {
    setRunDistance(0);
    setRunTime(0);
    setRunCoords([]);
    setCurrentLocation(null);
    setRunMode(null);
    setTargetKm(null);
    setSelectedKm(null);
    setIsRunning(false);
    setIsPaused(false);
    setAguardandoLocalizacao(false);
  };

  const finalizarCorrida = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (watchSubscription) {
      watchSubscription.remove();
      setWatchSubscription(null);
    }

    setIsRunning(false);
    setIsPaused(false);

    const distanciaKm = runDistance / 1000;
    const tempoFormatado = formatarTempoCorrida(runTime);
    const ritmo = calcularRitmo(runDistance, runTime);
    const calorias = calcularCalorias(runDistance);
    const metaAlcancada = targetKm !== null && distanciaKm >= targetKm;

    setSummaryData({
      distancia: distanciaKm,
      tempo: tempoFormatado,
      ritmo,
      calorias,
      metaAlcancada,
      metaKm: targetKm || 0,
    });

    if (usuarioSalvo?.email && runDistance > 50) {
      const km = runDistance / 1000;
      const min = Math.round(runTime / 60);
      const novos = {
        ...userStats,
        corridasKm: +(userStats.corridasKm + km).toFixed(2),
        tempoTotalMinutos: userStats.tempoTotalMinutos + min,
        treinosRealizados: userStats.treinosRealizados + 1,
      };
      await salvarStatsUsuario(usuarioSalvo.email, novos);
      await atualizarDailyStats(usuarioSalvo.email, km, min);
    }

    setCurrentScreen('runSummary');
  };

  const confirmarKmPersonalizado = () => {
    const km = parseFloat(customKmInput.replace(',', '.'));
    if (isNaN(km) || km <= 0) {
      setCustomKmError('Digite um valor válido maior que 0');
      return;
    }
    if (km > 100) {
      setCustomKmError('Máximo permitido: 100 km');
      return;
    }
    setCustomKmError('');
    setShowCustomKmModal(false);
    setSelectedKm(km);
    setCustomKmInput('');
  };

  // ===== CADASTRO =====
  const handleRegister = async () => {
    setRegMessage(null);
    if (!regNome.trim() || !regEmail.trim() || !regPassword.trim()) {
      const msg = 'Preencha Nome, E-mail e Senha.';
      setRegMessage({ type: 'error', text: msg });
      exibirAlerta('Atenção', msg);
      return;
    }

    setLoading(true);
    try {
      const emailNorm = regEmail.trim().toLowerCase();
      const users = await obterTodosUsuarios();
      if (users.find((u) => u.email.toLowerCase() === emailNorm)) {
        setLoading(false);
        setRegMessage({ type: 'error', text: 'Este e-mail já está em uso.' });
        return;
      }

      const novo = {
        nome: regNome.trim(),
        email: emailNorm,
        password: regPassword,
        dataNascimento: regDataNasc,
        altura: regAltura,
        peso: regPeso,
        objetivo: regObjetivo,
      };

      const stored = await AsyncStorage.getItem(USERS_DB_KEY);
      const lista = stored ? JSON.parse(stored) : [];
      lista.push(novo);
      await AsyncStorage.setItem(USERS_DB_KEY, JSON.stringify(lista));
      await salvarStatsUsuario(emailNorm, DEFAULT_STATS);
      await salvarSessaoLocal({ nome: novo.nome, email: novo.email });

      setLoading(false);
      setWelcomeMessage(`Conta criada! Bem-vindo(a), ${novo.nome}! 💪`);
      setRegNome(''); setRegEmail(''); setRegPassword(''); setRegDataNasc(''); setRegAltura(''); setRegPeso(''); setRegObjetivo('');
      setCurrentScreen('home');
    } catch {
      setLoading(false);
      setRegMessage({ type: 'error', text: 'Erro ao salvar o cadastro.' });
    }
  };

  // ===== LOGIN =====
  const handleLogin = async () => {
    setLoginMessage(null);
    if (!email.trim() || !password.trim()) {
      setLoginMessage({ type: 'error', text: 'Preencha todos os campos.' });
      return;
    }

    setLoading(true);
    setTimeout(async () => {
      const emailNorm = email.trim().toLowerCase();
      const users = await obterTodosUsuarios();
      const user = users.find((u) => u.email.toLowerCase() === emailNorm);
      setLoading(false);

      if (!user) setLoginMessage({ type: 'error', text: 'E-mail não cadastrado.' });
      else if (user.password !== password) setLoginMessage({ type: 'error', text: 'Senha incorreta.' });
      else {
        await salvarSessaoLocal({ nome: user.nome, email: user.email });
        setWelcomeMessage(null);
        setForcarLoginCompleto(false);
        setCurrentScreen('home');
      }
    }, 600);
  };

  // ===================== TELAS =====================

  // SPLASH
  if (currentScreen === 'splash') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
        <View style={styles.content}>
          <View style={styles.logoBadgeContainer}>
            <View style={styles.glowEffect} />
            <View style={styles.logoShield}>
              <Image source={LOGO_IMAGE} style={styles.logoImage} resizeMode="cover" />
            </View>
          </View>
          <View style={styles.sloganContainer}>
            <Text style={styles.sloganText}>Seu treino. Seu ritmo.</Text>
            <Text style={styles.sloganHighlight}>Sua evolução.</Text>
          </View>
          <TouchableOpacity style={styles.startButton} onPress={() => setCurrentScreen('login')}>
            <Text style={styles.startButtonText}>COMEÇAR</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // RUN SETUP
  if (currentScreen === 'runSetup') {
    const kmOptions = [1, 2, 3, 5, 10];
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
        <View style={[styles.runSetupHeader, { paddingTop: Math.max(insets.top, 8) }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => { setSelectedKm(null); setCurrentScreen('home'); }}>
            <Ionicons name="chevron-back" size={28} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.runSetupTitle}>Como você quer correr?</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView contentContainerStyle={[styles.runSetupContent, { paddingBottom: insets.bottom + 30 }]}>
          <View style={styles.runOptionCard}>
            <View style={styles.runOptionHeader}>
              <View style={styles.runOptionIcon}>
                <MaterialCommunityIcons name="target" size={26} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.runOptionTitle}>POR META</Text>
                <Text style={styles.runOptionSubtitle}>Escolha quantos quilômetros quer correr.</Text>
              </View>
            </View>
            <View style={styles.kmGrid}>
              {kmOptions.map((km) => (
                <TouchableOpacity
                  key={km}
                  style={[styles.kmButton, selectedKm === km && styles.kmButtonSelected]}
                  onPress={() => setSelectedKm(km)}
                >
                  <Text style={[styles.kmButtonText, selectedKm === km && styles.kmButtonTextSelected]}>{km} km</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.kmButton, selectedKm === -1 && styles.kmButtonSelected]}
                onPress={() => { setSelectedKm(-1); setShowCustomKmModal(true); }}
              >
                <Text style={[styles.kmButtonText, selectedKm === -1 && styles.kmButtonTextSelected]}>Outra</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.runOptionCard}
            onPress={() => {
              setRunMode('livre');
              setTargetKm(null);
              setIsRunning(false);
              setCurrentScreen('running');
            }}
          >
            <View style={styles.runOptionHeader}>
              <View style={styles.runOptionIcon}>
                <MaterialCommunityIcons name="infinity" size={26} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.runOptionTitle}>MODO LIVRE</Text>
                <Text style={styles.runOptionSubtitle}>Corra pelo tempo que quiser.</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={COLORS.textMuted} />
            </View>
          </TouchableOpacity>

          {selectedKm !== null && selectedKm !== -1 && (
            <TouchableOpacity
              style={styles.startRunButton}
              onPress={() => {
                setRunMode('meta');
                setTargetKm(selectedKm);
                setIsRunning(false);
                setCurrentScreen('running');
              }}
            >
              <Text style={styles.startRunButtonText}>INICIAR CORRIDA • {selectedKm} km</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        <Modal visible={showCustomKmModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowCustomKmModal(false)} />
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Distância personalizada</Text>
                <TouchableOpacity onPress={() => setShowCustomKmModal(false)}>
                  <Ionicons name="close" size={24} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalDescription}>Digite quantos km você quer correr:</Text>
              <View style={styles.modalInputContainer}>
                <TextInput
                  style={styles.modalInput}
                  placeholder="0"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="decimal-pad"
                  value={customKmInput}
                  onChangeText={setCustomKmInput}
                  autoFocus
                />
                <Text style={styles.modalInputSuffix}>km</Text>
              </View>
              {!!customKmError && (
                <View style={styles.modalErrorContainer}>
                  <Ionicons name="alert-circle" size={16} color={COLORS.errorText} />
                  <Text style={styles.modalErrorText}>{customKmError}</Text>
                </View>
              )}
              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalButton, styles.modalButtonCancel]} onPress={() => setShowCustomKmModal(false)}>
                  <Text style={styles.modalButtonCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.modalButtonConfirm]} onPress={confirmarKmPersonalizado}>
                  <Text style={styles.modalButtonConfirmText}>Confirmar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // RUNNING
  if (currentScreen === 'running') {
    const distanciaKm = (runDistance / 1000).toFixed(2).replace('.', ',');
    const ritmo = calcularRitmo(runDistance, runTime);
    const calorias = calcularCalorias(runDistance);

    if (!isRunning) {
      // ===== TELA DO SONIC DANÇANDO (COM GIF LOCAL) =====
      if (aguardandoLocalizacao) {
        return (
          <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 }}>
              <Image
                source={SONIC_GIF}
                style={{ width: 200, height: 200, marginBottom: 24 }}
                resizeMode="contain"
              />
              <ActivityIndicator size="large" color={COLORS.primary} style={{ marginBottom: 20 }} />
              <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 12 }}>
                Aguarde...
              </Text>
              <Text style={{ color: COLORS.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 22 }}>
                Estamos recebendo a sua localização{'\n'}
                para ativação do mapa
              </Text>
            </View>
          </SafeAreaView>
        );
      }

      // ===== TELA DE PEDIR PERMISSÃO =====
      return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
          <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
          <View style={[styles.runSetupHeader, { paddingTop: Math.max(insets.top, 8) }]}>
            <TouchableOpacity style={styles.backButton} onPress={() => setCurrentScreen('runSetup')}>
              <Ionicons name="chevron-back" size={28} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.runSetupTitle}>
              {runMode === 'meta' ? `Meta: ${targetKm} km` : 'Modo Livre'}
            </Text>
            <View style={{ width: 28 }} />
          </View>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 }}>
            <Ionicons name="location" size={72} color={COLORS.primary} style={{ marginBottom: 24 }} />
            <Text style={{ color: COLORS.text, fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 12 }}>
              Precisamos da sua localização
            </Text>
            <Text style={{ color: COLORS.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 36 }}>
              Para registrar o percurso e mostrar o mapa em tempo real.
            </Text>
            <TouchableOpacity style={styles.startRunButton} onPress={iniciarTracking}>
              <Text style={styles.startRunButtonText}>ATIVAR LOCALIZAÇÃO E COMEÇAR</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    // ===== TELA DA CORRIDA (MAPA) =====
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

        {Platform.OS !== 'web' && currentLocation && MapView ? (
          <MapView
            style={{ flex: 1 }}
            initialRegion={{
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            showsUserLocation={true}
            followsUserLocation={true}
            showsMyLocationButton={false}
            showsCompass={false}
            loadingEnabled={true}
            loadingIndicatorColor={COLORS.primary}
            mapType="standard"
          >
            {runCoords.length > 1 && (
              <Polyline
                coordinates={runCoords}
                strokeColor={COLORS.primary}
                strokeWidth={5}
                lineCap="round"
              />
            )}
          </MapView>
        ) : (
          <View style={{ flex: 1, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={{ color: COLORS.text, marginTop: 16 }}>Carregando mapa...</Text>
          </View>
        )}

        <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
          <View style={styles.runningTopBar}>
            <TouchableOpacity onPress={finalizarCorrida} style={styles.runningCloseBtn}>
              <Ionicons name="close" size={26} color={COLORS.text} />
            </TouchableOpacity>
            <View style={styles.gpsBadge}>
              <View style={[styles.gpsDot, isPaused && { backgroundColor: '#FF5252' }]} />
              <Text style={styles.gpsText}>{isPaused ? 'PAUSADO' : 'GPS ATIVO'}</Text>
            </View>
          </View>
        </SafeAreaView>

        <View style={[styles.runningBottomPanel, { paddingBottom: Math.max(insets.bottom + 10, 24) }]}>
          <Text style={styles.runningDistance}>
            {distanciaKm} <Text style={{ fontSize: 22 }}>km</Text>
          </Text>
          <View style={styles.runningStatsRow}>
            <View style={styles.runningStat}>
              <Text style={styles.runningStatValue}>{formatarTempoCorrida(runTime)}</Text>
              <Text style={styles.runningStatLabel}>Tempo</Text>
            </View>
            <View style={styles.runningStat}>
              <Text style={styles.runningStatValue}>{ritmo}</Text>
              <Text style={styles.runningStatLabel}>min/km</Text>
            </View>
            <View style={styles.runningStat}>
              <Text style={styles.runningStatValue}>{calorias}</Text>
              <Text style={styles.runningStatLabel}>kcal</Text>
            </View>
          </View>
          <View style={styles.runningControls}>
            <TouchableOpacity style={styles.controlBtn} onPress={finalizarCorrida}>
              <Ionicons name="stop" size={28} color={COLORS.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlBtnMain} onPress={togglePause}>
              <Ionicons name={isPaused ? 'play' : 'pause'} size={34} color={COLORS.bg} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlBtn}>
              <Ionicons name="lock-closed" size={24} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // RUN SUMMARY
  if (currentScreen === 'runSummary') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
        <ScrollView contentContainerStyle={[styles.summaryContainer, { paddingTop: Math.max(insets.top, 12) }]} showsVerticalScrollIndicator={false}>
          <View style={styles.summaryHeader}>
            <TouchableOpacity style={styles.summaryBackBtn} onPress={() => { limparDadosCorrida(); setCurrentScreen('home'); }}>
              <Ionicons name="chevron-back" size={26} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.summaryHeaderTitle}>Resumo da Corrida</Text>
            <View style={{ width: 26 }} />
          </View>

          <View style={styles.summaryIconContainer}>
            <View style={styles.summaryIconCircle}>
              <Ionicons name={summaryData.metaAlcancada ? 'trophy' : 'checkmark'} size={40} color={COLORS.bg} />
            </View>
          </View>

          <View style={styles.summaryMetaContainer}>
            <Text style={styles.summaryMetaTitle}>
              {summaryData.metaAlcancada ? 'Meta alcançada! 🎉' : 'Corrida finalizada!'}
            </Text>
            <Text style={styles.summaryMetaSubtitle}>
              {summaryData.metaKm > 0 ? `Meta: ${summaryData.metaKm} km` : 'Modo Livre'}
            </Text>
          </View>

          {runCoords.length > 0 && MapView ? (
            <View style={styles.summaryMapContainer}>
              <MapView
                style={styles.summaryMap}
                initialRegion={{
                  latitude: runCoords[Math.floor(runCoords.length / 2)]?.latitude || 0,
                  longitude: runCoords[Math.floor(runCoords.length / 2)]?.longitude || 0,
                  latitudeDelta: 0.012,
                  longitudeDelta: 0.012,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
                showsUserLocation={false}
                mapType="standard"
              >
                {runCoords.length > 1 && (
                  <Polyline coordinates={runCoords} strokeColor={COLORS.primary} strokeWidth={4} />
                )}
              </MapView>
              <Text style={styles.summaryMapLabel}>Seu percurso</Text>
            </View>
          ) : null}

          <View style={styles.summaryStatsGrid}>
            <View style={[styles.summaryStatCard, { marginRight: 8 }]}>
              <View style={styles.summaryStatIconContainer}>
                <Ionicons name="walk" size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.summaryStatValue}>{summaryData.distancia.toFixed(2).replace('.', ',')}</Text>
              <Text style={styles.summaryStatLabel}>Distância</Text>
              <Text style={styles.summaryStatUnit}>km</Text>
            </View>
            <View style={[styles.summaryStatCard, { marginLeft: 8 }]}>
              <View style={styles.summaryStatIconContainer}>
                <Ionicons name="time" size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.summaryStatValue}>{summaryData.tempo}</Text>
              <Text style={styles.summaryStatLabel}>Tempo</Text>
            </View>
          </View>

          <View style={styles.summaryStatsGrid}>
            <View style={[styles.summaryStatCard, { marginRight: 8 }]}>
              <View style={styles.summaryStatIconContainer}>
                <Ionicons name="speedometer" size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.summaryStatValue}>{summaryData.ritmo}</Text>
              <Text style={styles.summaryStatLabel}>Ritmo</Text>
              <Text style={styles.summaryStatUnit}>min/km</Text>
            </View>
            <View style={[styles.summaryStatCard, { marginLeft: 8 }]}>
              <View style={styles.summaryStatIconContainer}>
                <Ionicons name="flame" size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.summaryStatValue}>{summaryData.calorias}</Text>
              <Text style={styles.summaryStatLabel}>Calorias</Text>
              <Text style={styles.summaryStatUnit}>kcal</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.summaryDetailButton}
            onPress={() => { limparDadosCorrida(); setCurrentScreen('home'); }}
          >
            <Text style={styles.summaryDetailButtonText}>VOLTAR PARA O INÍCIO</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // REGISTER
  if (currentScreen === 'register') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={[styles.scrollContainer, { paddingTop: Math.max(insets.top, 12) }]} keyboardShouldPersistTaps="handled">
            <View style={styles.headerRow}>
              <TouchableOpacity style={styles.backButton} onPress={() => setCurrentScreen('login')}>
                <Ionicons name="chevron-back" size={26} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.titleSection}>
              <Text style={styles.pageTitle}>Criar conta</Text>
              <Text style={styles.pageSubtitle}>Vamos começar!</Text>
            </View>
            {regMessage && (
              <View style={[styles.messageBanner, { backgroundColor: COLORS.errorBg, borderColor: COLORS.errorBorder }]}>
                <Ionicons name="alert-circle" size={20} color={COLORS.errorText} style={{ marginRight: 8 }} />
                <Text style={[styles.messageBannerText, { color: COLORS.errorText }]}>{regMessage.text}</Text>
              </View>
            )}
            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Nome completo</Text>
                <TextInput style={styles.input} placeholder="Digite seu nome" placeholderTextColor={COLORS.textMuted} value={regNome} onChangeText={setRegNome} />
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>E-mail</Text>
                <TextInput style={styles.input} placeholder="Digite seu e-mail" placeholderTextColor={COLORS.textMuted} keyboardType="email-address" autoCapitalize="none" value={regEmail} onChangeText={setRegEmail} />
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Senha</Text>
                <View style={styles.inputWithIconWrapper}>
                  <TextInput style={[styles.input, { flex: 1, borderWidth: 0 }]} placeholder="Crie uma senha" placeholderTextColor={COLORS.textMuted} secureTextEntry={!showRegPassword} value={regPassword} onChangeText={setRegPassword} />
                  <TouchableOpacity style={styles.iconPadding} onPress={() => setShowRegPassword(!showRegPassword)}>
                    <Ionicons name={showRegPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Data de nascimento</Text>
                <TextInput style={styles.input} placeholder="DD / MM / AAAA" placeholderTextColor={COLORS.textMuted} keyboardType="numeric" value={regDataNasc} onChangeText={setRegDataNasc} />
              </View>
              <View style={styles.rowTwoInputs}>
                <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>Altura</Text>
                  <View style={styles.inputWithIconWrapper}>
                    <TextInput style={[styles.input, { flex: 1, borderWidth: 0 }]} placeholder="175" placeholderTextColor={COLORS.textMuted} keyboardType="numeric" value={regAltura} onChangeText={setRegAltura} />
                    <Text style={styles.suffixText}>cm</Text>
                  </View>
                </View>
                <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.label}>Peso</Text>
                  <View style={styles.inputWithIconWrapper}>
                    <TextInput style={[styles.input, { flex: 1, borderWidth: 0 }]} placeholder="72" placeholderTextColor={COLORS.textMuted} keyboardType="numeric" value={regPeso} onChangeText={setRegPeso} />
                    <Text style={styles.suffixText}>kg</Text>
                  </View>
                </View>
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Objetivo</Text>
                <TextInput style={styles.input} placeholder="Ex: Emagrecer, ganhar massa..." placeholderTextColor={COLORS.textMuted} value={regObjetivo} onChangeText={setRegObjetivo} />
              </View>
              <TouchableOpacity style={styles.submitButton} onPress={handleRegister} disabled={loading}>
                {loading ? <ActivityIndicator color={COLORS.bg} /> : <Text style={styles.submitButtonText}>CRIAR CONTA</Text>}
              </TouchableOpacity>
            </View>
            <View style={styles.footer}>
              <Text style={styles.footerText}>Já tem conta? </Text>
              <TouchableOpacity onPress={() => setCurrentScreen('login')}><Text style={styles.signUpText}>Entrar</Text></TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // HOME
  if (currentScreen === 'home') {
    const nome = usuarioSalvo?.nome || 'Atleta';
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
        <ScrollView contentContainerStyle={[styles.homeScroll, { paddingTop: Math.max(insets.top + 8, 16), paddingBottom: 90 + insets.bottom }]}>
          <View style={styles.homeHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.homeGreeting}>Olá, {nome}! 👋</Text>
              <Text style={styles.homeSubtitle}>Pronto para evoluir hoje?</Text>
            </View>
            <TouchableOpacity onPress={() => setCurrentScreen('login')} style={styles.bellButton}>
              <Ionicons name="notifications-outline" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {welcomeMessage && (
            <View style={styles.welcomeBanner}>
              <Ionicons name="checkmark-circle" size={22} color={COLORS.successText} style={{ marginRight: 10 }} />
              <Text style={styles.welcomeBannerText}>{welcomeMessage}</Text>
              <TouchableOpacity onPress={() => setWelcomeMessage(null)}>
                <Ionicons name="close" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.todayCard}>
            <View style={styles.todayHeader}>
              <Text style={styles.todayTitle}>Hoje</Text>
              <Text style={styles.todayDate}>{getDataAtual().split('-').reverse().join('/')}</Text>
            </View>
            <View style={styles.todayStats}>
              <View style={styles.todayStatItem}>
                <View style={styles.todayStatIcon}>
                  <Ionicons name="walk" size={18} color={COLORS.primary} />
                </View>
                <Text style={styles.todayStatValue}>{formatarKmHoje(dailyStats.kmHoje)}</Text>
                <Text style={styles.todayStatLabel}>Distância</Text>
              </View>
              <View style={styles.todayDivider} />
              <View style={styles.todayStatItem}>
                <View style={styles.todayStatIcon}>
                  <Ionicons name="time" size={18} color={COLORS.primary} />
                </View>
                <Text style={styles.todayStatValue}>{formatarMinutosHoje(dailyStats.minutosHoje)}</Text>
                <Text style={styles.todayStatLabel}>Tempo</Text>
              </View>
            </View>
          </View>

          <View style={styles.homeCard}>
            <View style={styles.homeCardLeft}>
              <Text style={styles.homeCardTitle}>Treino de hoje</Text>
              <Text style={styles.homeCardSubtitle}>{userStats.treinosRealizados === 0 ? 'Nenhum treino ainda' : 'Continue evoluindo'}</Text>
              <TouchableOpacity style={styles.homeCardButton}>
                <Text style={styles.homeCardButtonText}>VER TREINOS</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.homeCardImagePlaceholder}>
              <Ionicons name="barbell-outline" size={34} color={COLORS.primary} />
            </View>
          </View>

          <View style={styles.homeCard}>
            <View style={styles.homeCardLeft}>
              <Text style={styles.homeCardTitle}>Corrida</Text>
              <Text style={styles.homeCardSubtitle}>
                {userStats.corridasKm === 0 ? 'Quer começar a correr?' : `Você já correu ${formatarKm(userStats.corridasKm)}`}
              </Text>
              <TouchableOpacity
                style={[styles.homeCardButton, { marginTop: 10 }]}
                onPress={() => { setSelectedKm(null); setCurrentScreen('runSetup'); }}
              >
                <Text style={styles.homeCardButtonText}>INICIAR CORRIDA</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.homeCardImagePlaceholder}>
              <Ionicons name="walk-outline" size={34} color={COLORS.primary} />
            </View>
          </View>

          <View style={styles.homeCard}>
            <View style={styles.homeCardLeft}>
              <Text style={styles.homeCardTitle}>SONI AI</Text>
              <Text style={styles.homeCardSubtitle}>Analise sua refeição</Text>
              <TouchableOpacity style={[styles.homeCardButton, { marginTop: 10 }]}>
                <Text style={styles.homeCardButtonText}>ANALISAR AGORA</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.homeCardImagePlaceholder}>
              <Ionicons name="nutrition-outline" size={34} color={COLORS.primary} />
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="barbell" size={18} color={COLORS.primary} />
              <Text style={styles.statValue}>{userStats.treinosRealizados}</Text>
              <Text style={styles.statLabel}>Treinos</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="walk" size={18} color={COLORS.primary} />
              <Text style={styles.statValue}>{formatarKm(userStats.corridasKm)}</Text>
              <Text style={styles.statLabel}>Corridas</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="time-outline" size={18} color={COLORS.primary} />
              <Text style={styles.statValue}>{formatarTempo(userStats.tempoTotalMinutos)}</Text>
              <Text style={styles.statLabel}>Tempo</Text>
            </View>
          </View>
        </ScrollView>

        <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity style={styles.tabItem}>
            <Ionicons name="home" size={22} color={COLORS.primary} />
            <Text style={[styles.tabLabel, { color: COLORS.primary }]}>Início</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabItem}>
            <Ionicons name="barbell-outline" size={22} color={COLORS.textMuted} />
            <Text style={styles.tabLabel}>Treinos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabItem} onPress={() => { setSelectedKm(null); setCurrentScreen('runSetup'); }}>
            <Ionicons name="walk-outline" size={22} color={COLORS.textMuted} />
            <Text style={styles.tabLabel}>Corrida</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabItem}>
            <Ionicons name="person-outline" size={22} color={COLORS.textMuted} />
            <Text style={styles.tabLabel}>Perfil</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // LOGIN
  const temSessaoAtiva = !!usuarioSalvo && !forcarLoginCompleto;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.scrollContainer, { paddingTop: Math.max(insets.top, 12) }]} keyboardShouldPersistTaps="handled">
          <View style={styles.loginHeader}>
            <TouchableOpacity style={styles.backButton} onPress={() => setCurrentScreen('splash')}>
              <Ionicons name="chevron-back" size={26} color={COLORS.text} />
            </TouchableOpacity>
            <View style={styles.smallLogoRow}>
              <Text style={styles.smallLogoAlfa}>SONI</Text>
              <Text style={styles.smallLogoFit}>FIT</Text>
            </View>
            <View style={{ width: 26 }} />
          </View>

          {temSessaoAtiva ? (
            <View style={styles.sessionActiveContainer}>
              <Text style={styles.loginTitle}>Bem-vindo de volta!</Text>
              <Text style={styles.loginSubtitle}>Você já está logado neste dispositivo.</Text>
              <View style={styles.sessionCard}>
                <View style={styles.sessionAvatar}>
                  <Text style={styles.sessionAvatarText}>{usuarioSalvo!.nome.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={styles.sessionName}>{usuarioSalvo!.nome}</Text>
                <Text style={styles.sessionEmail}>{usuarioSalvo!.email}</Text>
              </View>
              <TouchableOpacity style={styles.submitButton} onPress={() => setCurrentScreen('home')}>
                <Text style={styles.submitButtonText}>ENTRAR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={logoutUsuario}>
                <Text style={styles.secondaryButtonText}>SAIR DESTA CONTA</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.linkButton} onPress={() => { setForcarLoginCompleto(true); setEmail(''); setPassword(''); }}>
                <Text style={styles.linkButtonText}>Entrar com outra conta</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.welcomeContainer}>
                <Text style={styles.loginTitle}>Bem-vindo de volta!</Text>
                <Text style={styles.loginSubtitle}>Entre na sua conta para continuar evoluindo.</Text>
              </View>
              {loginMessage && (
                <View style={[styles.messageBanner, { backgroundColor: COLORS.errorBg, borderColor: COLORS.errorBorder }]}>
                  <Ionicons name="alert-circle" size={20} color={COLORS.errorText} style={{ marginRight: 8 }} />
                  <Text style={[styles.messageBannerText, { color: COLORS.errorText }]}>{loginMessage.text}</Text>
                </View>
              )}
              <View style={styles.form}>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>E-mail</Text>
                  <TextInput style={styles.input} placeholder="Digite seu e-mail" placeholderTextColor={COLORS.textMuted} keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
                </View>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Senha</Text>
                  <View style={styles.inputWithIconWrapper}>
                    <TextInput style={[styles.input, { flex: 1, borderWidth: 0 }]} placeholder="Digite sua senha" placeholderTextColor={COLORS.textMuted} secureTextEntry={!showPassword} value={password} onChangeText={setPassword} />
                    <TouchableOpacity style={styles.iconPadding} onPress={() => setShowPassword(!showPassword)}>
                      <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>
                <TouchableOpacity style={styles.forgotButton}>
                  <Text style={styles.forgotText}>Esqueceu sua senha?</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitButton} onPress={handleLogin} disabled={loading}>
                  {loading ? <ActivityIndicator color={COLORS.bg} /> : <Text style={styles.submitButtonText}>ENTRAR</Text>}
                </TouchableOpacity>
                <View style={styles.dividerContainer}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>ou</Text>
                  <View style={styles.dividerLine} />
                </View>
                <TouchableOpacity style={styles.googleButton}>
                  <FontAwesome name="google" size={18} color="#EA4335" style={{ marginRight: 10 }} />
                  <Text style={styles.googleButtonText}>Entrar com Google</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.testBox}>
                <Text style={styles.testTitle}>💡 Conta de teste: usuario@sonifit.com | 123456</Text>
              </View>
              <View style={styles.footer}>
                <Text style={styles.footerText}>Ainda não tem conta? </Text>
                <TouchableOpacity onPress={() => setCurrentScreen('register')}>
                  <Text style={styles.signUpText}>Criar conta</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  logoBadgeContainer: { position: 'relative', alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  glowEffect: { position: 'absolute', width: 230, height: 230, borderRadius: 115, backgroundColor: COLORS.primary, opacity: 0.2 },
  logoShield: { width: 200, height: 200, borderRadius: 100, backgroundColor: COLORS.card, borderWidth: 3, borderColor: COLORS.primary, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  logoImage: { width: '100%', height: '100%' },
  sloganContainer: { alignItems: 'center', marginBottom: 40 },
  sloganText: { color: COLORS.textMuted, fontSize: 15, fontWeight: '500', marginBottom: 2 },
  sloganHighlight: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  startButton: { backgroundColor: COLORS.primary, width: '85%', maxWidth: 320, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  startButtonText: { color: COLORS.bg, fontSize: 16, fontWeight: '900', letterSpacing: 1 },

  scrollContainer: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 32 },
  headerRow: { paddingTop: 4, marginBottom: 12 },
  loginHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, marginBottom: 16 },
  backButton: { padding: 6 },
  smallLogoRow: { flexDirection: 'row' },
  smallLogoAlfa: { color: COLORS.text, fontSize: 20, fontWeight: '900' },
  smallLogoFit: { color: COLORS.primary, fontSize: 20, fontWeight: '900' },
  titleSection: { alignItems: 'center', marginBottom: 16 },
  pageTitle: { color: COLORS.text, fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  pageSubtitle: { color: COLORS.textMuted, fontSize: 14 },
  welcomeContainer: { alignItems: 'center', marginBottom: 20, marginTop: 8 },
  loginTitle: { color: COLORS.text, fontSize: 22, fontWeight: 'bold', marginBottom: 6, textAlign: 'center' },
  loginSubtitle: { color: COLORS.textMuted, fontSize: 14, textAlign: 'center' },
  messageBanner: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 16 },
  messageBannerText: { fontSize: 13, fontWeight: '600', flex: 1 },
  form: { width: '100%' },
  inputContainer: { marginBottom: 14 },
  rowTwoInputs: { flexDirection: 'row' },
  label: { color: COLORS.text, fontSize: 13, marginBottom: 6, fontWeight: '600' },
  input: { backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 16, paddingVertical: 13, color: COLORS.text, fontSize: 14 },
  inputWithIconWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  iconPadding: { paddingHorizontal: 16 },
  suffixText: { color: COLORS.textMuted, paddingRight: 16, fontSize: 13 },
  forgotButton: { alignSelf: 'flex-end', marginBottom: 20 },
  forgotText: { color: COLORS.primary, fontSize: 12, fontWeight: '600' },
  submitButton: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8, marginBottom: 12 },
  submitButtonText: { color: COLORS.bg, fontWeight: '900', fontSize: 15 },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { color: COLORS.textMuted, paddingHorizontal: 16, fontSize: 12 },
  googleButton: { backgroundColor: COLORS.text, borderRadius: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  googleButtonText: { color: '#000', fontWeight: 'bold', fontSize: 14 },
  testBox: { backgroundColor: COLORS.card, borderRadius: 8, padding: 10, marginTop: 12, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  testTitle: { color: COLORS.primary, fontSize: 12, fontWeight: 'bold' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { color: COLORS.textMuted, fontSize: 13 },
  signUpText: { color: COLORS.primary, fontSize: 13, fontWeight: 'bold' },

  sessionActiveContainer: { alignItems: 'center', paddingTop: 10 },
  sessionCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 24, alignItems: 'center', width: '100%', marginTop: 20, marginBottom: 20, borderWidth: 1, borderColor: COLORS.primary },
  sessionAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  sessionAvatarText: { color: COLORS.bg, fontSize: 28, fontWeight: '900' },
  sessionName: { color: COLORS.text, fontSize: 18, fontWeight: '700', marginBottom: 4 },
  sessionEmail: { color: COLORS.textMuted, fontSize: 13 },
  secondaryButton: { backgroundColor: 'transparent', borderRadius: 12, paddingVertical: 14, alignItems: 'center', width: '100%', borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  secondaryButtonText: { color: COLORS.text, fontWeight: '700', fontSize: 14 },
  linkButton: { paddingVertical: 8 },
  linkButtonText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },

  homeScroll: { paddingHorizontal: 16 },
  homeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  homeGreeting: { color: COLORS.text, fontSize: 22, fontWeight: 'bold', marginBottom: 2 },
  homeSubtitle: { color: COLORS.textMuted, fontSize: 14 },
  bellButton: { padding: 6 },
  welcomeBanner: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.successBg, borderWidth: 1, borderColor: COLORS.successBorder, borderRadius: 12, padding: 14, marginBottom: 16 },
  welcomeBannerText: { flex: 1, color: COLORS.successText, fontSize: 13, fontWeight: '600', lineHeight: 20 },

  todayCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.primary },
  todayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  todayTitle: { color: COLORS.text, fontSize: 16, fontWeight: 'bold' },
  todayDate: { color: COLORS.textMuted, fontSize: 12 },
  todayStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  todayStatItem: { alignItems: 'center', flex: 1 },
  todayStatIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1A1D24', justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  todayStatValue: { color: COLORS.primary, fontSize: 20, fontWeight: 'bold' },
  todayStatLabel: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  todayDivider: { width: 1, height: 40, backgroundColor: COLORS.border },

  homeCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 14, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  homeCardLeft: { flex: 1, paddingRight: 10 },
  homeCardTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  homeCardSubtitle: { color: COLORS.textMuted, fontSize: 13, marginTop: 2 },
  homeCardButton: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, alignSelf: 'flex-start', marginTop: 10 },
  homeCardButtonText: { color: COLORS.bg, fontSize: 12, fontWeight: '800' },
  homeCardImagePlaceholder: { width: 70, height: 70, borderRadius: 12, backgroundColor: '#1A1D24', justifyContent: 'center', alignItems: 'center' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginBottom: 16 },
  statItem: { flex: 1, backgroundColor: COLORS.card, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginHorizontal: 3, borderWidth: 1, borderColor: COLORS.border },
  statValue: { color: COLORS.text, fontSize: 14, fontWeight: '700', marginTop: 5 },
  statLabel: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  tabBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { color: COLORS.textMuted, fontSize: 11, marginTop: 3 },

  runSetupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  runSetupTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  runSetupContent: { paddingHorizontal: 16, paddingTop: 10 },
  runOptionCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  runOptionHeader: { flexDirection: 'row', alignItems: 'center' },
  runOptionIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#1A1D24', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  runOptionTitle: { color: COLORS.text, fontSize: 16, fontWeight: '800' },
  runOptionSubtitle: { color: COLORS.textMuted, fontSize: 13, marginTop: 2 },
  kmGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, gap: 10 },
  kmButton: { backgroundColor: '#1A1D24', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 18, borderWidth: 1, borderColor: COLORS.border, minWidth: 80, alignItems: 'center' },
  kmButtonSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  kmButtonText: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  kmButtonTextSelected: { color: COLORS.bg, fontWeight: '800' },
  startRunButton: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 18, alignItems: 'center', marginTop: 10 },
  startRunButtonText: { color: COLORS.bg, fontSize: 15, fontWeight: '900' },

  runningTopBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8 },
  runningCloseBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center' },
  gpsBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  gpsDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginRight: 6 },
  gpsText: { color: COLORS.text, fontSize: 12, fontWeight: '700' },
  runningBottomPanel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(10,11,14,0.96)', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 24, paddingHorizontal: 20, alignItems: 'center' },
  runningDistance: { color: COLORS.primary, fontSize: 52, fontWeight: '900', marginBottom: 16 },
  runningStatsRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-around', marginBottom: 24 },
  runningStat: { alignItems: 'center' },
  runningStatValue: { color: COLORS.text, fontSize: 22, fontWeight: '700' },
  runningStatLabel: { color: COLORS.textMuted, fontSize: 12, marginTop: 4 },
  runningControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28, marginBottom: 8 },
  controlBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  controlBtnMain: { width: 74, height: 74, borderRadius: 37, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },

  summaryContainer: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  summaryBackBtn: { padding: 6 },
  summaryHeaderTitle: { color: COLORS.text, fontSize: 20, fontWeight: '700' },
  summaryIconContainer: { alignItems: 'center', marginBottom: 16 },
  summaryIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  summaryMetaContainer: { alignItems: 'center', marginBottom: 24 },
  summaryMetaTitle: { color: COLORS.text, fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  summaryMetaSubtitle: { color: COLORS.textMuted, fontSize: 15 },
  summaryStatsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryStatCard: { flex: 1, backgroundColor: COLORS.card, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  summaryStatIconContainer: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1A1D24', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  summaryStatValue: { color: COLORS.text, fontSize: 20, fontWeight: 'bold' },
  summaryStatLabel: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  summaryStatUnit: { color: COLORS.textMuted, fontSize: 10, marginTop: 1 },
  summaryDetailButton: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
  summaryDetailButtonText: { color: COLORS.bg, fontSize: 14, fontWeight: '900' },

  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  modalContainer: { backgroundColor: COLORS.card, borderRadius: 24, padding: 24, width: '90%', maxWidth: 400, borderWidth: 1, borderColor: COLORS.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { color: COLORS.text, fontSize: 20, fontWeight: 'bold' },
  modalDescription: { color: COLORS.textMuted, fontSize: 14, marginBottom: 20 },
  modalInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bg, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 16, marginBottom: 8 },
  modalInput: { flex: 1, color: COLORS.text, fontSize: 24, fontWeight: 'bold', paddingVertical: 16 },
  modalInputSuffix: { color: COLORS.textMuted, fontSize: 18, fontWeight: '600' },
  modalErrorContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.errorBg, borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: COLORS.errorBorder },
  modalErrorText: { color: COLORS.errorText, fontSize: 13, marginLeft: 8, flex: 1 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  modalButton: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalButtonCancel: { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.border },
  modalButtonCancelText: { color: COLORS.textMuted, fontSize: 15, fontWeight: '600' },
  modalButtonConfirm: { backgroundColor: COLORS.primary },
  modalButtonConfirmText: { color: COLORS.bg, fontSize: 15, fontWeight: 'bold' },

  summaryMapContainer: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#111',
  },
  summaryMap: {
    width: '100%',
    height: '100%',
  },
  summaryMapLabel: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
});
