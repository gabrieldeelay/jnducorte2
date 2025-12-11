import { BookingRecord } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';

const DB_KEY = 'jn_bookings_history';
const SHOP_STATUS_ID = 'SHOP_STATUS_SETTINGS';

// Simula um delay de rede para feedback visual
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Dados iniciais para popular o banco caso esteja vazio (Para demonstração local)
const SEED_DATA: BookingRecord[] = [
  {
    id: 'demo-1',
    userName: 'Marcos Cliente Exemplo',
    userPhone: '(27) 99999-0000',
    serviceName: 'Corte + Barba',
    barberName: 'Jeilson Aprijo',
    date: new Date().toLocaleDateString('pt-BR'),
    time: '10:00',
    price: 60.00,
    createdAt: new Date(Date.now() - 86400000).toISOString(), 
    status: 'completed',
    completedAt: new Date().toISOString()
  }
];

export const bookingService = {
  // LISTAR (SELECT *)
  async getAll(): Promise<BookingRecord[]> {
    // MODO NUVEM (SUPABASE)
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        // Filtra para não trazer o registro de configuração da loja na lista normal
        .neq('id', SHOP_STATUS_ID)
        .order('createdAt', { ascending: false });
      
      if (error) {
        throw new Error(`Erro Supabase: ${error.message}`);
      }
      return data as BookingRecord[] || [];
    }

    // MODO LOCAL
    console.warn("⚠️ Usando Banco Local (Sem sincronização).");
    return this.getLocalOnly();
  },

  // Busca agendamentos específicos de um dia e barbeiro para verificar disponibilidade
  async getAvailability(date: string, barberName: string): Promise<string[]> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('bookings')
        .select('time')
        .eq('date', date)
        .eq('barberName', barberName)
        .neq('status', 'cancelled') // Não bloquear horários cancelados
        .neq('id', SHOP_STATUS_ID);

      if (error) return [];
      return data.map((d: any) => d.time);
    }
    
    // Fallback Local
    const records = await this.getLocalOnly();
    return records
      .filter(r => r.date === date && r.barberName === barberName && r.status !== 'cancelled')
      .map(r => r.time);
  },

  // Busca APENAS local
  async getLocalOnly(): Promise<BookingRecord[]> {
    await delay(600);
    const data = localStorage.getItem(DB_KEY);
    
    if (!data) {
      if (!isSupabaseConfigured()) {
        localStorage.setItem(DB_KEY, JSON.stringify(SEED_DATA));
        return SEED_DATA;
      }
      return [];
    }

    try {
      const list = JSON.parse(data);
      // Filtra o settings ID caso tenha vazado pro local storage
      return list
        .filter((r: BookingRecord) => r.id !== SHOP_STATUS_ID)
        .sort((a: BookingRecord, b: BookingRecord) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    } catch (error) {
      return [];
    }
  },

  // CRIAR (INSERT)
  async create(booking: BookingRecord): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase
        .from('bookings')
        .insert([booking]);
      
      if (error) {
        console.error('Erro ao salvar no Supabase:', error.message || error);
        
        // --- FALLBACK DE ROBUSTEZ ---
        // Se o erro for "column does not exist" (código 42703), significa que o usuário
        // não atualizou o banco de dados. Tentamos salvar removendo campos novos (completedAt).
        if (error.code === '42703') {
             console.warn("⚠️ Tentando salvar sem campos opcionais (migration pendente)...");
             // Remove 'completedAt' e tenta novamente
             const { completedAt, ...safeBooking } = booking;
             const { error: retryError } = await supabase
                .from('bookings')
                .insert([safeBooking]);
             
             if (retryError) {
                 console.error('Erro fatal no fallback:', retryError.message);
                 throw retryError;
             }
             return; // Sucesso no fallback
        }

        throw error;
      }
      return;
    }

    await delay(800);
    const data = localStorage.getItem(DB_KEY);
    const currentList = data ? JSON.parse(data) : [];
    const newList = [...currentList, booking];
    localStorage.setItem(DB_KEY, JSON.stringify(newList));
  },

  // EDITAR REGISTRO COMPLETO (UPDATE)
  async update(booking: BookingRecord): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase
        .from('bookings')
        .update({
            userName: booking.userName,
            userPhone: booking.userPhone,
            serviceName: booking.serviceName,
            barberName: booking.barberName,
            date: booking.date,
            time: booking.time,
            price: booking.price,
            status: booking.status,
            // completedAt: booking.completedAt // Removido temporariamente para evitar quebra no update se coluna não existir
        })
        .eq('id', booking.id);
        
      if (error) console.error('Erro ao atualizar Supabase:', error.message);
    }

    const data = localStorage.getItem(DB_KEY);
    if (data) {
        const list: BookingRecord[] = JSON.parse(data);
        const updatedList = list.map(item => 
          item.id === booking.id ? booking : item
        );
        localStorage.setItem(DB_KEY, JSON.stringify(updatedList));
    }
  },

  // ATUALIZAR STATUS (UPDATE PARCIAL)
  async updateStatus(id: string, status: 'completed' | 'cancelled'): Promise<void> {
    // Prepara objeto de update
    const updates: any = { status };
    
    // Se estiver concluindo, grava a data de agora para o financeiro contabilizar HOJE
    // OBS: Se o banco não tiver a coluna 'completedAt', isso pode gerar erro silencioso ou logado
    if (status === 'completed') {
        updates.completedAt = new Date().toISOString();
    }

    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase
        .from('bookings')
        .update(updates)
        .eq('id', id);
        
      if (error) {
        console.error('Erro ao atualizar status no Supabase:', error.message);
        // Tenta novamente sem o completedAt se falhar
        if (error.code === '42703' && updates.completedAt) {
            delete updates.completedAt;
            await supabase.from('bookings').update(updates).eq('id', id);
        }
      }
    }

    const data = localStorage.getItem(DB_KEY);
    if (data) {
        const list: BookingRecord[] = JSON.parse(data);
        const updatedList = list.map(item => 
          item.id === id ? { ...item, ...updates } : item
        );
        localStorage.setItem(DB_KEY, JSON.stringify(updatedList));
    }
  },

  // DELETAR (DELETE)
  async delete(id: string): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id);

      if (error) console.error('Erro ao deletar Supabase:', error.message);
    }

    const data = localStorage.getItem(DB_KEY);
    if (data) {
        const list: BookingRecord[] = JSON.parse(data);
        const updatedList = list.filter(item => item.id !== id);
        localStorage.setItem(DB_KEY, JSON.stringify(updatedList));
    }
  },

  // --- MÉTODOS DE TRAVA DA LOJA ---
  
  async getShopStatus(): Promise<'open' | 'closed'> {
    if (isSupabaseConfigured() && supabase) {
      const { data } = await supabase
        .from('bookings')
        .select('status')
        .eq('id', SHOP_STATUS_ID)
        .single();
      
      if (data) {
        return data.status === 'cancelled' ? 'closed' : 'open';
      }
      return 'open'; 
    }
    return 'open';
  },

  async setShopStatus(isOpen: boolean): Promise<void> {
    const status = isOpen ? 'pending' : 'cancelled'; 
    
    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase
        .from('bookings')
        .upsert({
          id: SHOP_STATUS_ID,
          userName: 'SYSTEM_SETTINGS',
          userPhone: '00000000000',
          serviceName: 'Shop Status Control',
          barberName: 'System',
          date: '01/01/2099',
          time: '00:00',
          price: 0,
          status: status
        });

      if (error) console.error("Erro ao atualizar status da loja", error.message);
    }
  }
};