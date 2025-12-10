
import { Service, Barber } from './types';

export const BARBER_PHONE = '5527997290483';

export const BARBERS: Barber[] = [
  { 
    id: 'jeilson', 
    name: 'Jeilson Aprijo', 
    avatarUrl: 'https://i.ibb.co/PGNc6PTy/jn.png' 
  },
  { 
    id: 'igor', 
    name: 'Igor Aprijo', 
    avatarUrl: 'https://i.ibb.co/XkMjqBQL/ig.png' 
  },
  { 
    id: 'marcos', 
    name: 'Marcos Daniel', 
    avatarUrl: 'https://i.ibb.co/Q7NkgdBr/MD.png' 
  },
];

export const SERVICES: Service[] = [
  // --- Cortes e Rosto ---
  // 1. Mais requisitado
  {
    id: 'corte',
    name: 'Corte',
    price: 35.00,
    duration: 30, // Ajustado para média de 30min
    description: 'Corte degradê, social ou militar na máquina e tesoura.',
    category: 'cortes_rosto',
    isPopular: true
  },
  // Ordenados por preço crescente
  {
    id: 'sobrancelha',
    name: 'Sobrancelha',
    price: 10.00,
    duration: 15,
    description: 'Design e limpeza com navalha para um olhar marcante.',
    category: 'cortes_rosto'
  },
  {
    id: 'acabamento',
    name: 'Acabamento / Pezinho',
    price: 10.00,
    duration: 15,
    description: 'Manutenção dos contornos do cabelo e pescoço.',
    category: 'cortes_rosto'
  },
  {
    id: 'limpeza_pele',
    name: 'Limpeza de Pele',
    price: 15.00,
    duration: 20,
    description: 'Remoção de impurezas superficiais e hidratação.',
    category: 'cortes_rosto'
  },
  {
    id: 'barba',
    name: 'Barba',
    price: 25.00,
    duration: 30,
    description: 'Modelagem completa com toalha quente e pós-barba.',
    category: 'cortes_rosto'
  },
  {
    id: 'corte_infantil',
    name: 'Corte Infantil',
    price: 40.00,
    duration: 30,
    description: 'Corte especializado para crianças com todo cuidado.',
    category: 'cortes_rosto'
  },
  {
    id: 'corte_tesoura',
    name: 'Corte na Tesoura',
    price: 40.00,
    duration: 40,
    description: 'Corte clássico ou moderno executado totalmente na tesoura.',
    category: 'cortes_rosto'
  },

  // --- Química e Estilo ---
  // 1. Mais requisitado
  {
    id: 'nevou',
    name: 'Nevou (Platinado)',
    price: 130.00,
    duration: 120,
    description: 'Descoloração global. Valor a partir de R$ 130,00.',
    category: 'quimica_estilo',
    isPopular: true
  },
  // Ordenados por preço crescente
  {
    id: 'pigmentacao',
    name: 'Pigmentação',
    price: 25.00,
    duration: 30,
    description: 'Tintura para realçar contornos da barba ou cabelo.',
    category: 'quimica_estilo'
  },
  {
    id: 'luzes',
    name: 'Luzes',
    price: 80.00,
    duration: 90,
    description: 'Iluminação dos fios com técnica de mechas.',
    category: 'quimica_estilo'
  },
  {
    id: 'reflexo',
    name: 'Reflexo Alinhado',
    price: 100.00,
    duration: 120,
    description: 'Técnica avançada de luzes com design específico.',
    category: 'quimica_estilo'
  },
  {
    id: 'consultoria',
    name: 'Consultoria Vip',
    price: 100.00,
    duration: 60,
    description: 'Análise de visagismo completa para definir seu melhor estilo.',
    category: 'quimica_estilo'
  },
  {
    id: 'colorimetria',
    name: 'Colorimetria',
    price: 130.00,
    duration: 120,
    description: 'Coloração personalizada. Valor a partir de R$ 130,00.',
    category: 'quimica_estilo'
  }
];

// Generate time slots: 30 min intervals
// 08:00 - 20:00 (Last slot 19:30)
export const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
  '19:00', '19:30'
];

export const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
