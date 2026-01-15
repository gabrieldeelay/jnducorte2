
import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { ServiceCard } from './components/ServiceCard';
import { BookingState, BookingRecord, ServiceCategory, Service } from './types';
import { SERVICES, TIME_SLOTS, DAYS_OF_WEEK, BARBER_PHONE, BARBERS } from './constants';
import { bookingService } from './services/bookingService';
import { isSupabaseConfigured, supabase } from './services/supabase';
import { Calendar, ChevronLeft, ChevronRight, ArrowRight, CheckCircle2, MessageCircle, Clock, User, Scissors, MapPin, Instagram, Phone, Lock, LogIn, LayoutDashboard, Smartphone, Check, X, Sparkles, UserCircle2, Trash2, Loader2, CloudOff, Cloud, Database, RefreshCcw, Bell, BellOff, Volume2, XCircle, Activity, Download, Wifi, Search, CalendarCheck, Ban, Filter, DollarSign, ArrowDownUp, SlidersHorizontal, Store, Power, List, Grid3X3, Settings, TrendingUp, CalendarDays, FileSpreadsheet, Plus, Edit2, Save, Eye, EyeOff } from 'lucide-react';

// Declaração global para o OneSignal
declare global {
  interface Window {
    OneSignalDeferred: any[];
  }
}

const App: React.FC = () => {
  const [booking, setBooking] = useState<BookingState>({
    step: 'home',
    selectedCategory: null,
    selectedServices: [],
    selectedBarber: null,
    selectedDate: null,
    selectedTime: null,
    userName: '',
    userPhone: '',
  });

  const [adminCredentials, setAdminCredentials] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  
  // Database States
  const [bookingHistory, setBookingHistory] = useState<BookingRecord[]>([]);
  const [isLoadingDB, setIsLoadingDB] = useState(false); // Loading for list
  const [isSaving, setIsSaving] = useState(false); // Loading for save actions
  const [isCloudEnabled, setIsCloudEnabled] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [viewingLocal, setViewingLocal] = useState(false);
  
  // Shop Status (Trava Global)
  const [isShopOpen, setIsShopOpen] = useState(true);
  const [isLoadingShopStatus, setIsLoadingShopStatus] = useState(true);

  // Availability Check (Horários ocupados)
  const [busySlots, setBusySlots] = useState<string[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  
  // Dashboard Filters & View State
  const [filterBarber, setFilterBarber] = useState('all');
  const [filterPrice, setFilterPrice] = useState('all');
  const [sortBy, setSortBy] = useState<'created_desc' | 'schedule_asc'>('created_desc');
  const [dashboardView, setDashboardView] = useState<'list' | 'calendar'>('list');
  const [dashboardDate, setDashboardDate] = useState<Date>(new Date());
  const [adminTab, setAdminTab] = useState<'bookings' | 'finance' | 'settings'>('bookings');

  // Finance Filters
  const [financeFilter, setFinanceFilter] = useState<'today' | '7days' | '30days' | 'custom'>('today');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');

  // Transaction Manager States (New Feature)
  const [showTransactionManager, setShowTransactionManager] = useState(false);
  const [transactionSearch, setTransactionSearch] = useState('');
  const [editingTransaction, setEditingTransaction] = useState<BookingRecord | null>(null);
  const [isManualAddOpen, setIsManualAddOpen] = useState(false);
  // Manual Add Form State
  const [manualForm, setManualForm] = useState({
      value: '',
      description: '',
      barber: BARBERS[0].name,
      date: new Date().toISOString().split('T')[0],
      time: '00:00',
      clientName: ''
  });

  // Client Check Booking States
  const [searchPhone, setSearchPhone] = useState('');
  const [foundBookings, setFoundBookings] = useState<BookingRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Realtime States
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [lastSignalReceived, setLastSignalReceived] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<string>(new Date().toLocaleTimeString());

  // Notification State
  const [notificationsActive, setNotificationsActive] = useState(false);
  const notificationsActiveRef = useRef(false);
  
  // Rastreamento de IDs conhecidos para evitar duplicidade de notificação
  const knownIdsRef = useRef<Set<string>>(new Set());
  
  // In-App Toast Notification State
  const [toast, setToast] = useState<{ visible: boolean; title: string; message: string; subtext?: string } | null>(null);

  // Helper to generate next 14 days
  const [availableDates, setAvailableDates] = useState<Date[]>([]);

  // PWA Install Prompt
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    setIsCloudEnabled(isSupabaseConfigured());
    const dates = [];
    const today = new Date();
    // Start loop from today
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      // Skip Sundays (0) if barber is closed on Sundays? 
      // User request: Sunday is allowed but only until 12h. So we keep Sunday in the array.
      dates.push(d);
    }
    setAvailableDates(dates);

    // Carregar preferência de notificação
    const savedNotif = localStorage.getItem('jn_notifications_active');
    if (savedNotif === 'true') {
      setNotificationsActive(true);
      notificationsActiveRef.current = true;
    }
    
    // Check Shop Status on Load
    checkShopStatus();

    // Capture PWA install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });

    // --- INICIALIZAÇÃO ONESIGNAL (PUSH NOTIFICATION) ---
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(function(OneSignal: any) {
      try {
        OneSignal.init({
          appId: "c2876644-8025-4c07-b35f-15d6c820063e", 
          safari_web_id: "web.onesignal.auto.12345678",
          notifyButton: {
            enable: false, 
          },
          allowLocalhostAsSecureOrigin: true,
        });
      } catch (e) {
        console.log("OneSignal init error", e);
      }
    });

    // Clock Ticker
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);

    return () => clearInterval(clockInterval);

  }, []);

  // Fetch Busy Slots when Date or Barber changes
  useEffect(() => {
    if (booking.step === 'datetime' && booking.selectedDate && booking.selectedBarber) {
      const fetchAvailability = async () => {
        setIsLoadingSlots(true);
        try {
          const dateStr = booking.selectedDate!.toLocaleDateString('pt-BR');
          const busy = await bookingService.getAvailability(dateStr, booking.selectedBarber!.name);
          setBusySlots(busy);
        } catch (error) {
          console.error("Erro ao buscar disponibilidade:", error);
        } finally {
          setIsLoadingSlots(false);
        }
      };
      fetchAvailability();
    }
  }, [booking.step, booking.selectedDate, booking.selectedBarber]);

  const checkShopStatus = async () => {
    setIsLoadingShopStatus(true);
    try {
        const status = await bookingService.getShopStatus();
        setIsShopOpen(status === 'open');
    } catch(e) {
        console.error(e);
    } finally {
        setIsLoadingShopStatus(false);
    }
  };

  // Sincronizar Ref com State para uso dentro de Event Listeners
  useEffect(() => {
    notificationsActiveRef.current = notificationsActive;
  }, [notificationsActive]);

  // Load history when entering dashboard (Initial Load)
  useEffect(() => {
    if (booking.step === 'admin-dashboard') {
      loadHistory();
    }
  }, [booking.step]);

  // --- LÓGICA REALTIME (SUBSTITUI POLLING) ---
  useEffect(() => {
    let channel: any;

    // Conecta se estiver logado como admin OU para monitorar status da loja (SHOP_STATUS_SETTINGS)
    const shouldConnect = isCloudEnabled && supabase;

    if (shouldConnect) {
      console.log("🔌 Inicializando conexão Supabase Realtime...");
      
      channel = supabase
        .channel('public:bookings') 
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'bookings' },
          (payload) => {
            console.log("⚡ EVENTO REALTIME RECEBIDO:", payload);
            setLastSignalReceived(new Date().toLocaleTimeString()); 

            const newRecord = payload.new as BookingRecord;
            const oldRecord = payload.old as BookingRecord;

            // CHECK GLOBAL SHOP STATUS CHANGE
            if ((newRecord && newRecord.id === 'SHOP_STATUS_SETTINGS') || 
                (oldRecord && oldRecord.id === 'SHOP_STATUS_SETTINGS')) {
                const status = newRecord ? newRecord.status : 'pending';
                setIsShopOpen(status === 'pending'); // pending = open based on logic in service
                // If dashboard is open, no need to alert, just update toggle state logic visually
                return; 
            }

            // Normal Bookings logic only for Admin Dashboard
            if (booking.step === 'admin-dashboard') {
                if (payload.eventType === 'INSERT') {
                  // Ignore Settings Record
                  if (newRecord.id === 'SHOP_STATUS_SETTINGS') return;

                  setBookingHistory(prev => {
                    if (prev.find(item => item.id === newRecord.id)) return prev;
                    return [newRecord, ...prev];
                  });
                  handleNewBookingNotification(newRecord);
                }
                
                if (payload.eventType === 'UPDATE') {
                  if (newRecord.id === 'SHOP_STATUS_SETTINGS') return;
                  setBookingHistory(prev => prev.map(r => r.id === newRecord.id ? newRecord : r));
                }

                if (payload.eventType === 'DELETE') {
                  const deletedId = oldRecord.id;
                  if (deletedId === 'SHOP_STATUS_SETTINGS') return;
                  setBookingHistory(prev => prev.filter(r => r.id !== deletedId));
                }
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setRealtimeConnected(true);
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            setRealtimeConnected(false);
          }
        });
    }

    return () => {
      if (channel) {
        supabase?.removeChannel(channel);
        setRealtimeConnected(false);
      }
    };
  }, [booking.step, viewingLocal, isCloudEnabled]);


  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('Usuário aceitou instalar PWA');
        }
        setDeferredPrompt(null);
      });
    }
  };

  const toggleNotifications = async () => {
    if (!notificationsActive) {
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.volume = 0.01;
        audio.play().catch(() => {});
      } catch(e) {}

      const permission = await Notification.requestPermission();
      
      if (window.OneSignalDeferred) {
         window.OneSignalDeferred.push(function(OneSignal: any) {
             OneSignal.Slidedown.promptPush();
         });
      }

      setNotificationsActive(true);
      notificationsActiveRef.current = true;
      localStorage.setItem('jn_notifications_active', 'true');
      
      if (permission === 'granted') {
        triggerLocalNotification("🔔 Alertas Ativados", "Sistema monitorando em tempo real.", "Online");
      }

    } else {
      setNotificationsActive(false);
      notificationsActiveRef.current = false;
      localStorage.setItem('jn_notifications_active', 'false');
    }
  };

  const testNotification = () => {
    const fakeRecord: BookingRecord = {
        id: 'test-' + Date.now(),
        userName: 'Cliente Teste',
        userPhone: '(27) 99999-9999',
        serviceName: 'Teste de Som',
        barberName: 'Sistema',
        date: 'Agora',
        time: 'Agora',
        price: 0,
        createdAt: '',
        status: 'pending'
    };
    handleNewBookingNotification(fakeRecord);
  };

  const triggerLocalNotification = (title: string, body: string, subtext?: string) => {
      if (typeof navigator.vibrate === 'function') {
          navigator.vibrate([500, 200, 500]);
      }

      setToast({ visible: true, title, message: body, subtext });
      setTimeout(() => setToast(null), 8000);

      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.volume = 1.0;
        const playPromise = audio.play();
        
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.log("Audio playback prevented (Browser policy):", error);
          });
        }
      } catch (e) {
          console.error("Erro no player de áudio", e);
      }

      if (Notification.permission === 'granted') {
        try {
            if (navigator.serviceWorker && navigator.serviceWorker.ready) {
                navigator.serviceWorker.ready.then(registration => {
                    const options: any = {
                        body: body,
                        icon: 'https://i.ibb.co/FbQ2cm3v/Design-sem-nome-14.png',
                        tag: 'booking-alert',
                        vibrate: [500, 200, 500],
                        renotify: true,
                        data: { dateOfArrival: Date.now() }
                    };
                    registration.showNotification(title, options);
                });
            } else {
                const n = new Notification(title, {
                    body: body,
                    icon: 'https://i.ibb.co/FbQ2cm3v/Design-sem-nome-14.png',
                    requireInteraction: true, 
                    silent: false,
                });
                n.onclick = () => { window.focus(); };
            }
        } catch (e) {
            console.error("Erro notificação nativa:", e);
        }
      }
  };

  const handleNewBookingNotification = (record: BookingRecord) => {
    if (!notificationsActiveRef.current) return;

    const title = `Novo Cliente! 💈`;
    const body = `${record.userName} marcou ${record.serviceName} às ${record.time}.`;
    const subtext = `${record.barberName} - ${record.date}`;
    
    triggerLocalNotification(title, body, subtext);
  };

  const loadHistory = async () => {
    setIsLoadingDB(true);
    setDbError(null);
    setViewingLocal(false);
    try {
      const records = await bookingService.getAll();
      setBookingHistory(records);
      
      const ids = new Set(records.map(r => r.id));
      knownIdsRef.current = ids;
      
    } catch (error: any) {
      console.error("Erro ao carregar banco de dados", error);
      setDbError(error.message || "Erro desconhecido ao conectar no banco de dados.");
    } finally {
      setIsLoadingDB(false);
    }
  };

  const loadLocalHistory = async () => {
    setIsLoadingDB(true);
    setDbError(null);
    setViewingLocal(true);
    try {
        const records = await bookingService.getLocalOnly();
        setBookingHistory(records);
    } finally {
        setIsLoadingDB(false);
    }
  };

  const normalizePhone = (phone: string) => {
    return phone.replace(/\D/g, '');
  };

  const parseDate = (dateStr: string): Date => {
      if (!dateStr) return new Date();
      const [day, month, year] = dateStr.split('/').map(Number);
      return new Date(year, month - 1, day);
  };

  const getFinanceFilteredData = () => {
      const now = new Date();
      
      // Definição precisa do início e fim do dia "HOJE" em hora local
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      let rangeStart = startOfToday;
      let rangeEnd = endOfToday;

      if (financeFilter === '7days') {
          // Últimos 7 dias (incluindo hoje)
          // Ex: Se hoje é dia 10, pega desde dia 4 (10 - 6) até 10
          rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
      } else if (financeFilter === '30days') {
          // Últimos 30 dias (incluindo hoje)
          rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);
      } else if (financeFilter === 'custom') {
          if (customDateStart) {
              const [y, m, d] = customDateStart.split('-').map(Number);
              rangeStart = new Date(y, m - 1, d, 0, 0, 0, 0);
          } else {
              // Se não definiu início, pega tudo desde 2000
              rangeStart = new Date(2000, 0, 1);
          }
          
          if (customDateEnd) {
              const [y, m, d] = customDateEnd.split('-').map(Number);
              rangeEnd = new Date(y, m - 1, d, 23, 59, 59, 999);
          } else {
              // Se não definiu fim, vai até futuro distante (para não cortar pendentes futuros)
              rangeEnd = new Date(2100, 11, 31);
          }
      }

      return bookingHistory.filter(b => {
          let effectiveDate: Date;

          // LÓGICA DE FATURAMENTO:
          // Se completado, usa a data de conclusão (receita realizada).
          // Se pendente/cancelado, usa a data agendada.
          if (b.status === 'completed' && b.completedAt) {
              effectiveDate = new Date(b.completedAt);
          } else {
              effectiveDate = parseDate(b.date);
          }
          
          return effectiveDate >= rangeStart && effectiveDate <= rangeEnd;
      });
  };

  const handleSearchBookings = async () => {
    if (!searchPhone) return;
    
    setIsSearching(true);
    setHasSearched(true);
    try {
      const allBookings = await bookingService.getAll();
      const cleanSearch = normalizePhone(searchPhone);
      const found = allBookings.filter(b => 
        normalizePhone(b.userPhone).includes(cleanSearch) || 
        normalizePhone(b.userPhone) === cleanSearch
      );
      setFoundBookings(found.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e) {
      console.error(e);
      alert("Erro ao buscar agendamentos. Tente novamente.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleClientCancel = async (bookingId: string) => {
    if(!window.confirm("Deseja realmente cancelar este agendamento?")) return;
    
    setIsSearching(true); 
    try {
      await bookingService.updateStatus(bookingId, 'cancelled');
      setFoundBookings(prev => prev.map(b => 
        b.id === bookingId ? { ...b, status: 'cancelled' } : b
      ));
      alert("Agendamento cancelado com sucesso.");
    } catch (e) {
      alert("Erro ao cancelar. Tente entrar em contato pelo WhatsApp.");
    } finally {
      setIsSearching(false);
    }
  };

  const updateBooking = (updates: Partial<BookingState>) => {
    setBooking(prev => ({ ...prev, ...updates }));
  };

  const handleGoHome = () => {
    setBooking({
      step: 'home',
      selectedCategory: null,
      selectedServices: [],
      selectedBarber: null,
      selectedDate: null,
      selectedTime: null,
      userName: '',
      userPhone: '',
    });
    setAdminCredentials({ username: '', password: '' });
    setShowPassword(false);
    setLoginError('');
    setSearchPhone('');
    setFoundBookings([]);
    setHasSearched(false);
  };

  const handleAdminAccess = () => {
    updateBooking({ step: 'admin-login' });
  };

  const handleAdminLogin = () => {
    if (
      (adminCredentials.username === 'jnducorte' && adminCredentials.password === '123456') ||
      (adminCredentials.username === 'gamma' && adminCredentials.password === 'gamma')
    ) {
      updateBooking({ step: 'admin-dashboard' });
      setLoginError('');
    } else {
      setLoginError('Usuário ou senha incorretos');
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: 'completed' | 'cancelled') => {
    // Atualização Otimista
    setBookingHistory(prev => prev.map(record => {
        if (record.id === id) {
            const updates: any = { status: newStatus };
            if (newStatus === 'completed') {
                updates.completedAt = new Date().toISOString();
            }
            return { ...record, ...updates };
        }
        return record;
    }));
    await bookingService.updateStatus(id, newStatus);
  };

  const handleDeleteBooking = async (id: string) => {
    if(!window.confirm("Tem certeza que deseja excluir este agendamento?")) return;
    setBookingHistory(prev => prev.filter(record => record.id !== id));
    await bookingService.delete(id);
  };

  const handleToggleShopStatus = async () => {
    const newState = !isShopOpen;
    // Optimistic Update
    setIsShopOpen(newState);
    try {
        await bookingService.setShopStatus(newState);
    } catch (e) {
        setIsShopOpen(!newState); // Revert
        alert("Erro ao mudar status da loja");
    }
  };

  // --- LÓGICA DO GERENCIADOR DE TRANSAÇÕES ---

  // Salvar nova transação manual
  const handleSaveManualTransaction = async () => {
      if (!manualForm.value) {
          alert("Erro: O valor da transação é obrigatório.");
          return;
      }

      setIsSaving(true);
      
      // Formatar Data para BR
      const [year, month, day] = manualForm.date.split('-');
      const formattedDate = `${day}/${month}/${year}`;

      const newRecord: BookingRecord = {
          id: 'manual-' + Date.now(),
          userName: manualForm.clientName.trim() || 'Sistema', 
          userPhone: '00000000000', 
          serviceName: manualForm.description.trim() || 'N/A',
          barberName: manualForm.barber,
          date: formattedDate,
          time: '00:00', // Forçado para 00:00 como solicitado
          price: Number(manualForm.value),
          createdAt: new Date().toISOString(),
          status: 'completed', // Já entra como completado/pago
          completedAt: new Date().toISOString()
      };

      try {
          await bookingService.create(newRecord);
          // O Realtime já atualiza a lista, mas fazemos update otimista local
          setBookingHistory(prev => [newRecord, ...prev]);
          setIsManualAddOpen(false);
          setManualForm({
            value: '',
            description: '',
            barber: BARBERS[0].name,
            date: new Date().toISOString().split('T')[0],
            time: '00:00',
            clientName: ''
          });
          alert("Transação adicionada com sucesso!");
      } catch (e) {
          alert("Erro ao salvar.");
      } finally {
          setIsSaving(false);
      }
  };

  // Atualizar transação existente
  const handleUpdateTransaction = async () => {
      if (!editingTransaction) return;
      
      setIsSaving(true);
      try {
          await bookingService.update(editingTransaction);
          // Update otimista local
          setBookingHistory(prev => prev.map(item => item.id === editingTransaction.id ? editingTransaction : item));
          setEditingTransaction(null);
      } catch (e) {
          alert("Erro ao atualizar.");
      } finally {
          setIsSaving(false);
      }
  };

  const handleExportToExcel = () => {
      // CSV Header - Adicionado BOM (\uFEFF) para UTF-8 e ponto e vírgula para Excel BR
      let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
      csvContent += "ID;Data;Hora;Cliente;Serviço;Profissional;Valor;Status\n";

      // Filtered Data (Current View in Manager)
      const dataToExport = bookingHistory.filter(b => {
          if (b.id === 'SHOP_STATUS_SETTINGS') return false; // Ignora configurações internas
          const search = transactionSearch.toLowerCase();
          return (
              b.userName.toLowerCase().includes(search) || 
              b.serviceName.toLowerCase().includes(search) ||
              b.barberName.toLowerCase().includes(search)
          );
      });

      dataToExport.forEach(row => {
          const rowData = [
              row.id,
              row.date,
              row.time,
              `"${row.userName}"`, // Quote to handle content
              `"${row.serviceName}"`,
              row.barberName,
              row.price.toString().replace('.', ','), // Brazilian decimal format
              row.status
          ];
          // Use semicolon delimiter
          csvContent += rowData.join(";") + "\n";
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `transacoes_jn_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  // Helper Functions for Multi-Select
  const toggleService = (service: Service) => {
    setBooking(prev => {
        const exists = prev.selectedServices.find(s => s.id === service.id);
        if (exists) {
            return { ...prev, selectedServices: prev.selectedServices.filter(s => s.id !== service.id) };
        } else {
            return { ...prev, selectedServices: [...prev.selectedServices, service] };
        }
    });
  };

  const getTotalPrice = () => {
      return booking.selectedServices.reduce((acc, s) => acc + s.price, 0);
  };

  const getTotalDuration = () => {
      return booking.selectedServices.reduce((acc, s) => acc + s.duration, 0);
  };

  const calculateTimeLeft = (dateStr: string, timeStr: string) => {
    try {
      const [day, month, year] = dateStr.split('/').map(Number);
      const [hours, minutes] = timeStr.split(':').map(Number);
      const targetDate = new Date(year, month - 1, day, hours, minutes);
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();
      
      if (diff <= 0) return "Horário passou";

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hoursLeft = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      let result = '';
      if (days > 0) result += `${days}d `;
      if (hoursLeft > 0) result += `${hoursLeft}h `;
      result += `${minutesLeft}m`;
      
      return `Falta: ${result}`;
    } catch {
      return '';
    }
  };

  const getFilteredBookings = () => {
    let result = [...bookingHistory];

    if (filterBarber !== 'all') {
      result = result.filter(r => r.barberName === filterBarber);
    }

    if (filterPrice === 'low') { 
      result = result.filter(r => r.price <= 30);
    } else if (filterPrice === 'mid') { 
      result = result.filter(r => r.price > 30 && r.price <= 50);
    } else if (filterPrice === 'high') { 
      result = result.filter(r => r.price > 50);
    }

    if (sortBy === 'schedule_asc') {
      result.sort((a, b) => {
        const [dayA, monthA, yearA] = a.date.split('/').map(Number);
        const [hourA, minA] = a.time.split(':').map(Number);
        const dateA = new Date(yearA, monthA - 1, dayA, hourA, minA);

        const [dayB, monthB, yearB] = b.date.split('/').map(Number);
        const [hourB, minB] = b.time.split(':').map(Number);
        const dateB = new Date(yearB, monthB - 1, dayB, hourB, minB);

        return dateA.getTime() - dateB.getTime();
      });
    } else {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return result;
  };

  const changeCalendarDate = (days: number) => {
    const newDate = new Date(dashboardDate);
    newDate.setDate(dashboardDate.getDate() + days);
    setDashboardDate(newDate);
  };

  const confirmBooking = async () => {
    if (booking.selectedServices.length === 0 || !booking.selectedDate || !booking.selectedTime || !booking.selectedBarber) return;

    setIsSaving(true);
    const dateStr = booking.selectedDate.toLocaleDateString('pt-BR');
    
    // Combine names and sum prices
    const combinedServiceNames = booking.selectedServices.map(s => s.name).join(' + ');
    const totalPrice = getTotalPrice();

    const newRecord: BookingRecord = {
      id: Date.now().toString(),
      userName: booking.userName,
      userPhone: booking.userPhone,
      serviceName: combinedServiceNames,
      barberName: booking.selectedBarber.name,
      date: dateStr,
      time: booking.selectedTime,
      price: totalPrice,
      createdAt: new Date().toISOString(),
      status: 'pending'
    };

    try {
      await bookingService.create(newRecord);
      updateBooking({ step: 'summary' });
    } catch (e) {
      alert("Erro ao salvar agendamento. Verifique sua conexão ou se o banco de dados está configurado.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleNextStep = () => {
    if (booking.step === 'home') updateBooking({ step: 'category' });
    else if (booking.step === 'category') updateBooking({ step: 'service' });
    else if (booking.step === 'service') updateBooking({ step: 'barber' });
    else if (booking.step === 'barber') updateBooking({ step: 'datetime' });
    else if (booking.step === 'datetime') updateBooking({ step: 'details' });
    else if (booking.step === 'details') {
      confirmBooking();
    }
  };

  const handleBackStep = () => {
    if (booking.step === 'category') updateBooking({ step: 'home' });
    else if (booking.step === 'service') updateBooking({ step: 'category' }); // Don't clear selectedServices to allow adding more from other categories? Or keep simple flow.
    else if (booking.step === 'barber') updateBooking({ step: 'service' });
    else if (booking.step === 'datetime') updateBooking({ step: 'barber' });
    else if (booking.step === 'details') updateBooking({ step: 'datetime' });
    else if (booking.step === 'summary') updateBooking({ step: 'details' });
    else if (booking.step === 'check-booking') handleGoHome();
    else if (booking.step === 'admin-login') handleGoHome();
    else if (booking.step === 'admin-dashboard') handleGoHome();
  };

  const isTimeSlotAvailable = (timeSlot: string, selectedDate: Date | null) => {
    if (!selectedDate) return false;

    const now = new Date();
    const isToday = 
      selectedDate.getDate() === now.getDate() &&
      selectedDate.getMonth() === now.getMonth() &&
      selectedDate.getFullYear() === now.getFullYear();
    
    // Regra de Domingo (0) - Limite até 12:00
    if (selectedDate.getDay() === 0) {
        const [hour] = timeSlot.split(':').map(Number);
        if (hour >= 12) return false;
    }

    // Verifica se já está ocupado no banco (para o barbeiro selecionado)
    if (busySlots.includes(timeSlot)) {
        return false;
    }

    // Verifica se já passou do horário (se for hoje)
    if (!isToday) return true;

    const [hours, minutes] = timeSlot.split(':').map(Number);
    const slotTime = new Date(selectedDate);
    slotTime.setHours(hours, minutes, 0, 0);

    const bufferTime = new Date(now.getTime() + 30 * 60000);
    return slotTime > bufferTime;
  };

  const sendToWhatsApp = () => {
    if (booking.selectedServices.length === 0 || !booking.selectedDate || !booking.selectedTime || !booking.selectedBarber) return;

    const dateStr = booking.selectedDate.toLocaleDateString('pt-BR');
    const combinedServiceNames = booking.selectedServices.map(s => s.name).join(' + ');
    const totalPrice = getTotalPrice();

    const text = 
      `*NOVO AGENDAMENTO - JN DU CORTE*%0A%0A` +
      `*Cliente:* ${booking.userName}%0A` +
      `*Telefone:* ${booking.userPhone}%0A` +
      `*Profissional:* ${booking.selectedBarber.name}%0A` +
      `*Serviços:* ${combinedServiceNames}%0A` +
      `*Data:* _${dateStr}_%0A` +
      `*Hora:* _${booking.selectedTime}_%0A` +
      `*Valor Total:* R$ ${totalPrice.toFixed(2)}`;

    const url = `https://wa.me/${BARBER_PHONE}?text=${text}`;
    window.open(url, '_blank');
  };

  const handleContactClient = (record: BookingRecord) => {
    const cleanPhone = normalizePhone(record.userPhone);
    // Adiciona o prefixo 55 se o usuário não digitou
    const finalPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    
    const text = 
      `*CONFIRMAÇÃO DE AGENDAMENTO - JN DU CORTE*%0A%0A` +
      `*Cliente:* ${record.userName}%0A` +
      `*Telefone:* ${record.userPhone}%0A` +
      `*Profissional:* ${record.barberName}%0A` +
      `*Serviços:* ${record.serviceName}%0A` +
      `*Data:* _${record.date}_%0A` +
      `*Hora:* _${record.time}_%0A` +
      `*Valor Total:* R$ ${record.price.toFixed(2)}`;

    const url = `https://wa.me/${finalPhone}?text=${text}`;
    window.open(url, '_blank');
  };

  const openLocation = () => {
    window.open('https://www.google.com/maps/search/?api=1&query=-20.2242685,-40.2800837', '_blank');
  };

  const openInstagram = () => {
    window.open('https://www.instagram.com/barbeariajnducorte/', '_blank');
  };

  // --- RENDERIZADORES ---

  // Tela de Loja Fechada
  const renderClosedScreen = () => (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center animate-fade-in">
        <div className="w-24 h-24 bg-red-900/20 rounded-full flex items-center justify-center mb-6 border-4 border-red-900/30">
            <Store size={48} className="text-red-500" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-4">Agendamento Temporariamente Fechado</h2>
        <p className="text-slate-400 max-w-xs mx-auto mb-8 leading-relaxed">
            A barbearia não está aceitando agendamentos pelo aplicativo agora. Tente novamente mais tarde.
        </p>
        
        <button 
            onClick={() => window.open(`https://wa.me/${BARBER_PHONE}`, '_blank')}
            className="flex items-center gap-3 bg-[#25D366] hover:bg-[#20bd5a] text-white px-8 py-4 rounded-xl font-bold text-lg transition-transform hover:scale-105 shadow-lg shadow-green-900/20"
        >
            <MessageCircle size={24} />
            Falar no WhatsApp
        </button>
        
        <div className="mt-12">
            <button onClick={handleAdminAccess} className="text-slate-700 text-xs uppercase tracking-widest hover:text-slate-500">
                Acesso Admin
            </button>
        </div>
    </div>
  );

  const renderHomeStep = () => {
    // Se loja fechada, mostra tela de bloqueio
    if (!isShopOpen && !isLoadingShopStatus) {
        return renderClosedScreen();
    }

    return (
    <div className="flex flex-col gap-6">
      <div className="text-center py-8 space-y-2">
        <h2 className="text-3xl font-bold text-white tracking-tight">
          Estilo & <span className="text-red-600">Tradição</span>
        </h2>
        <p className="text-slate-400">O seu visual em outro nível.</p>
        
        {deferredPrompt && (
          <button 
            onClick={handleInstallClick}
            className="inline-flex items-center gap-2 bg-slate-800 text-slate-300 px-4 py-2 rounded-full text-xs font-bold border border-slate-700 mt-2 hover:bg-slate-700"
          >
            <Download size={14} /> Instalar App
          </button>
        )}
      </div>

      <div className="grid gap-4">
        <button
          onClick={handleNextStep}
          className="relative bg-gradient-to-br from-blue-900 to-slate-900 border border-slate-700 p-6 rounded-2xl text-left hover:border-red-600 group transition-all duration-300 shadow-xl overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Calendar size={80} />
          </div>
          <div className="relative z-10 flex flex-col gap-3">
            <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-900/50 group-hover:scale-110 transition-transform">
              <Scissors size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white group-hover:text-red-500 transition-colors">Novo Agendamento</h3>
              <p className="text-slate-400 text-sm mt-1">Escolha o serviço e o profissional</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => updateBooking({ step: 'check-booking' })}
          className="bg-slate-800 border border-slate-700 p-5 rounded-2xl flex items-center justify-between hover:bg-slate-750 transition-colors group"
        >
          <div className="flex items-center gap-4">
             <div className="bg-slate-700 p-3 rounded-xl text-slate-300 group-hover:text-white transition-colors">
                <CalendarCheck size={20} />
             </div>
             <div className="text-left">
                <h3 className="text-white font-semibold">Meus Agendamentos</h3>
                <p className="text-slate-400 text-xs">Consultar ou cancelar horário</p>
             </div>
          </div>
          <ArrowRight size={18} className="text-slate-500 group-hover:translate-x-1 transition-transform" />
        </button>

        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={openLocation}
            className="bg-slate-800 border border-slate-700 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-slate-750 transition-colors group"
          >
            <MapPin size={24} className="text-slate-400 group-hover:text-red-500 transition-colors" />
            <span className="text-sm font-medium text-slate-200">Localização</span>
          </button>

          <button 
            onClick={openInstagram}
            className="bg-slate-800 border border-slate-700 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-slate-750 transition-colors group"
          >
            <Instagram size={24} className="text-slate-400 group-hover:text-pink-500 transition-colors" />
            <span className="text-sm font-medium text-slate-200">Instagram</span>
          </button>
        </div>
      </div>

      <div className="mt-8 text-center border-t border-slate-800 pt-6">
        <p className="text-xs text-slate-600 uppercase tracking-widest mb-2">Horário de Funcionamento</p>
        <div className="flex items-center justify-center gap-2 text-slate-400 text-sm">
          <Clock size={14} />
          <span>Seg a Sáb: 08:00 - 20:00</span>
        </div>
      </div>
    </div>
    );
  };

  const renderCheckBookingStep = () => (
    <div className="pb-32">
      <h2 className="text-xl font-bold text-white mb-2">Meus Agendamentos</h2>
      <p className="text-slate-400 text-sm mb-6">Digite seu telefone para encontrar seus horários.</p>

      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-6">
        <label className="block text-xs uppercase text-slate-500 font-bold mb-2">Seu Telefone</label>
        <div className="flex gap-2">
            <input
              type="tel"
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
              placeholder="Ex: 27999999999"
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-blue-500 transition-colors"
            />
            <button 
              onClick={handleSearchBookings}
              disabled={isSearching || searchPhone.length < 8}
              className={`px-4 rounded-lg flex items-center justify-center transition-all ${
                searchPhone.length < 8 
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/30'
              }`}
            >
              {isSearching ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
            </button>
        </div>
      </div>

      {hasSearched && foundBookings.length === 0 && !isSearching && (
        <div className="text-center py-8 text-slate-500">
           <CloudOff size={48} className="mx-auto mb-3 opacity-50" />
           <p>Nenhum agendamento encontrado para este número.</p>
           <p className="text-xs mt-1">Tente digitar apenas os números.</p>
        </div>
      )}

      <div className="space-y-4">
        {foundBookings.map((record) => (
          <div key={record.id} className="bg-slate-800 border border-slate-700 rounded-xl p-5 animate-slide-up relative overflow-hidden">
             {record.status === 'cancelled' && (
                <div className="absolute top-0 right-0 bg-red-500/10 text-red-500 text-[10px] uppercase font-bold px-2 py-1 rounded-bl-lg">
                    Cancelado
                </div>
             )}
             
             <div className="flex justify-between items-start mb-3">
                <div>
                    <h3 className="font-bold text-white text-lg">{record.serviceName}</h3>
                    <p className="text-slate-400 text-sm flex items-center gap-1">
                        <User size={12} /> {record.barberName}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-white font-medium">{record.date}</p>
                    <p className="text-blue-400 text-sm font-bold">{record.time}</p>
                </div>
             </div>

             <div className="border-t border-slate-700/50 pt-3 mt-3 flex justify-between items-center">
                 <span className="text-slate-500 text-sm">Status: <span className={record.status === 'completed' ? 'text-green-500' : record.status === 'cancelled' ? 'text-red-500' : 'text-yellow-500'}>
                    {record.status === 'completed' ? 'Concluído' : record.status === 'cancelled' ? 'Cancelado' : 'Pendente'}
                 </span></span>
                 
                 {(record.status === 'pending' || !record.status) && (
                     <button
                        onClick={() => handleClientCancel(record.id)}
                        disabled={isSearching}
                        className="text-xs bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/30 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                     >
                        <Ban size={12} /> Cancelar Agendamento
                     </button>
                 )}
             </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderCategoryStep = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white mb-2">Qual tipo de serviço?</h2>
      
      <button
        onClick={() => {
          updateBooking({ selectedCategory: 'cortes_rosto' });
          handleNextStep();
        }}
        className="w-full bg-slate-800 border border-slate-700 hover:border-red-600 p-6 rounded-2xl text-left group transition-all relative overflow-hidden"
      >
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 rounded-full bg-blue-900/30 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
            <UserCircle2 size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white group-hover:text-red-500 transition-colors">Cortes e Rosto</h3>
            <p className="text-slate-400 text-sm">Barba, cabelo, sobrancelha e cuidados faciais.</p>
          </div>
        </div>
      </button>

      <button
        onClick={() => {
          updateBooking({ selectedCategory: 'quimica_estilo' });
          handleNextStep();
        }}
        className="w-full bg-slate-800 border border-slate-700 hover:border-red-600 p-6 rounded-2xl text-left group transition-all relative overflow-hidden"
      >
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 rounded-full bg-purple-900/30 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Sparkles size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white group-hover:text-red-500 transition-colors">Química e Estilo</h3>
            <p className="text-slate-400 text-sm">Luzes, pigmentação, platinado e consultoria.</p>
          </div>
        </div>
      </button>
    </div>
  );

  const renderServiceStep = () => {
    const filteredServices = SERVICES.filter(s => s.category === booking.selectedCategory);
    
    return (
      <div className="space-y-4 pb-32">
        <h2 className="text-xl font-bold text-white mb-2">
          {booking.selectedCategory === 'cortes_rosto' ? 'Cortes e Rosto' : 'Química e Estilo'}
        </h2>
        <p className="text-slate-400 text-sm mb-4">
            Selecione um ou mais procedimentos.
        </p>
        <div className="space-y-3">
          {filteredServices.map(service => {
            const isSelected = booking.selectedServices.some(s => s.id === service.id);
            return (
              <ServiceCard
                key={service.id}
                service={service}
                isSelected={isSelected}
                onSelect={(s) => toggleService(s)}
              />
            );
          })}
        </div>
      </div>
    );
  };

  const renderBarberStep = () => (
    <div className="space-y-4 pb-32">
      <h2 className="text-xl font-bold text-white mb-2">Escolha o barbeiro</h2>
      <p className="text-slate-400 text-sm mb-4">Selecione quem vai cuidar do seu estilo hoje.</p>
      
      <div className="grid grid-cols-2 gap-4">
        {BARBERS.map(barber => {
          const isSelected = booking.selectedBarber?.id === barber.id;
          return (
            <button
              key={barber.id}
              onClick={() => {
                  updateBooking({ selectedBarber: barber });
                  handleNextStep(); // Auto-advance
              }}
              className={`relative p-4 rounded-2xl border transition-all duration-300 flex flex-col items-center justify-center gap-3 text-center group ${
                isSelected
                  ? 'bg-blue-900/20 border-red-600 shadow-[0_0_15px_rgba(220,38,38,0.2)]'
                  : 'bg-slate-800 border-slate-700 hover:border-slate-500 hover:bg-slate-750'
              }`}
            >
              <div className={`w-24 h-24 rounded-full border-4 overflow-hidden shadow-lg mb-2 transition-transform group-hover:scale-105 ${
                 isSelected ? 'border-red-600' : 'border-slate-600'
              }`}>
                <img 
                    src={barber.avatarUrl} 
                    alt={barber.name} 
                    className="w-full h-full object-cover"
                />
              </div>
              
              <div className="space-y-1">
                <span className={`block font-semibold ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                  {barber.name}
                </span>
                <span className="text-xs text-slate-500">Barbeiro</span>
              </div>
              
              {isSelected && (
                <div className="absolute top-3 right-3 text-red-500">
                  <CheckCircle2 size={16} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderDateTimeStep = () => (
    <div className="pb-32">
      <h2 className="text-xl font-bold text-white mb-4">Escolha a data</h2>
      
      <div className="flex gap-3 overflow-x-auto pb-4 mb-4 scrollbar-hide snap-x">
        {availableDates
          .filter(date => {
            // Se o barbeiro for o Marcos (id: 'marcos'), mostrar apenas Sábados (6)
            if (booking.selectedBarber?.id === 'marcos') {
                return date.getDay() === 6;
            }
            return true;
          })
          .map((date, idx) => {
          const isSelected = booking.selectedDate?.toDateString() === date.toDateString();
          return (
            <button
              key={idx}
              onClick={() => updateBooking({ selectedDate: date, selectedTime: null })}
              className={`flex-shrink-0 w-20 p-3 rounded-2xl flex flex-col items-center justify-center border transition-all snap-start ${
                isSelected
                  ? 'bg-blue-900/40 border-red-500 text-white font-bold shadow-lg shadow-red-500/10'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              <span className={`text-xs uppercase tracking-wider mb-1 ${isSelected ? 'text-red-400' : 'opacity-80'}`}>{DAYS_OF_WEEK[date.getDay()]}</span>
              <span className="text-2xl">{date.getDate()}</span>
            </button>
          );
        })}
      </div>

      {booking.selectedDate && (
        <div className="animate-fade-in">
          <h2 className="text-xl font-bold text-white mb-4">Horários disponíveis</h2>
          
          {isLoadingSlots ? (
            <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-red-500" size={32} />
            </div>
          ) : (
          <div className="grid grid-cols-4 gap-3">
            {TIME_SLOTS.map((time) => {
              // Verifica lógica local (Domingo/Hoje)
              const isAvailable = isTimeSlotAvailable(time, booking.selectedDate);
              // Verifica bloqueio vindo do banco (busySlots)
              const isBlockedByDB = busySlots.includes(time);
              
              const isSelectable = isAvailable && !isBlockedByDB;
              const isSelected = booking.selectedTime === time;

              return (
                <button
                  key={time}
                  onClick={() => isSelectable && updateBooking({ selectedTime: time })}
                  disabled={!isSelectable}
                  className={`p-2 rounded-lg text-sm font-medium border transition-all relative overflow-hidden ${
                    isSelected
                      ? 'bg-red-600 border-red-600 text-white shadow-md'
                      : isSelectable
                        ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-red-500/50 hover:text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-700 cursor-not-allowed opacity-50'
                  }`}
                  title={isBlockedByDB ? 'Horário Ocupado' : ''}
                >
                  {time}
                </button>
              );
            })}
          </div>
          )}
          
          {!isLoadingSlots && TIME_SLOTS.every(t => !isTimeSlotAvailable(t, booking.selectedDate) || busySlots.includes(t)) && (
             <p className="text-center text-slate-500 text-sm mt-4">Nenhum horário disponível para esta data.</p>
          )}
          {booking.selectedDate.getDay() === 0 && (
             <p className="text-center text-yellow-600 text-xs mt-4 flex items-center justify-center gap-1">
                <Clock size={12} /> Domingo: Atendimento até às 12:00
             </p>
          )}
        </div>
      )}
    </div>
  );

  const renderDetailsStep = () => (
    <div className="pb-32">
      <h2 className="text-xl font-bold text-white mb-6">Seus dados</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">Seu Nome Completo</label>
          <input
            type="text"
            value={booking.userName}
            onChange={(e) => updateBooking({ userName: e.target.value })}
            placeholder="Ex: João Silva"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white text-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">Seu Telefone / WhatsApp</label>
          <input
            type="tel"
            value={booking.userPhone}
            onChange={(e) => updateBooking({ userPhone: e.target.value })}
            placeholder="Ex: (27) 99999-9999"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white text-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
          />
        </div>
        
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 mt-4 space-y-3">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Resumo do Agendamento</p>
          
          <div className="flex gap-3 items-start">
             <div className="p-2 bg-blue-900/20 rounded-lg text-blue-400 mt-1">
                <Scissors size={18} />
             </div>
             <div>
                <p className="text-xs text-slate-400">Serviços</p>
                <div className="flex flex-col">
                    {booking.selectedServices.map(s => (
                        <p key={s.id} className="text-white font-medium text-sm">{s.name}</p>
                    ))}
                </div>
                <p className="text-red-400 font-bold text-sm mt-1">Total: R$ {getTotalPrice().toFixed(2)}</p>
             </div>
          </div>

          <div className="flex gap-3 items-center">
             <div className="p-2 bg-blue-900/20 rounded-lg text-blue-400">
                <User size={18} />
             </div>
             <div>
                <p className="text-xs text-slate-400">Profissional</p>
                <p className="text-white font-medium">{booking.selectedBarber?.name}</p>
             </div>
          </div>

          <div className="flex gap-3 items-center">
             <div className="p-2 bg-blue-900/20 rounded-lg text-blue-400">
                <Calendar size={18} />
             </div>
             <div>
                <p className="text-xs text-slate-400">Data e Hora</p>
                <p className="text-white font-medium">
                  {booking.selectedDate?.toLocaleDateString('pt-BR')} às {booking.selectedTime}
                </p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSummaryStep = () => (
    <div className="text-center pb-32">
      <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 text-green-500 animate-bounce">
        <CheckCircle2 size={40} />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Agendamento Realizado!</h2>
      <p className="text-slate-400 mb-8">Seu horário foi reservado no sistema.<br/>Envie a confirmação para o WhatsApp.</p>

      <div className="bg-slate-800 rounded-2xl p-6 text-left border border-slate-700 mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-900/10 rounded-bl-full -mr-4 -mt-4"></div>
        
        <div className="space-y-4 relative z-10">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Cliente</p>
            <p className="text-lg font-medium text-white">{booking.userName}</p>
            <p className="text-sm text-slate-400">{booking.userPhone}</p>
          </div>
          <div className="h-px bg-slate-700/50"></div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Serviços</p>
            <ul className="list-disc list-inside text-slate-200 font-medium">
                {booking.selectedServices.map(s => (
                    <li key={s.id}>{s.name}</li>
                ))}
            </ul>
            <p className="text-red-500 font-bold mt-2 text-xl">R$ {getTotalPrice().toFixed(2)}</p>
          </div>
          <div className="h-px bg-slate-700/50"></div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Profissional</p>
            <p className="text-lg font-medium text-white">{booking.selectedBarber?.name}</p>
          </div>
          <div className="h-px bg-slate-700/50"></div>
          <div className="flex justify-between">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Data</p>
              <p className="text-lg font-medium text-white">{booking.selectedDate?.toLocaleDateString('pt-BR')}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Horário</p>
              <p className="text-lg font-medium text-white">{booking.selectedTime}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAdminLoginStep = () => (
    <div className="flex flex-col justify-center min-h-[50vh]">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700">
          <Lock size={24} className="text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-white">Área Restrita</h2>
        <p className="text-slate-400 text-sm mt-1">Apenas para administradores</p>
      </div>

      <div className="space-y-4 bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
        <div>
          <label className="block text-xs uppercase text-slate-500 font-semibold mb-2">Usuário</label>
          <div className="relative">
             <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
             <input
              type="text"
              value={adminCredentials.username}
              onChange={(e) => setAdminCredentials(prev => ({ ...prev, username: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              placeholder="Digite seu usuário"
             />
          </div>
        </div>
        
        <div>
          <label className="block text-xs uppercase text-slate-500 font-semibold mb-2">Senha</label>
          <div className="relative">
             <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
             <input
              type={showPassword ? "text" : "password"}
              value={adminCredentials.password}
              onChange={(e) => setAdminCredentials(prev => ({ ...prev, password: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 pr-12 text-white focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              placeholder="Digite sua senha"
             />
             <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
             >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
             </button>
          </div>
        </div>

        {loginError && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
            {loginError}
          </div>
        )}

        <button
          onClick={handleAdminLogin}
          className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all mt-2"
        >
          <LogIn size={18} /> Entrar
        </button>
      </div>

      <button
        onClick={handleBackStep}
        className="mt-6 text-slate-400 hover:text-white text-sm flex items-center justify-center gap-2"
      >
        <ChevronLeft size={16} /> Voltar ao início
      </button>
    </div>
  );

  const renderDashboardCalendar = () => {
    const currentDateStr = dashboardDate.toLocaleDateString('pt-BR');
    
    // Filter bookings for the selected date
    const dayBookings = bookingHistory.filter(b => b.date === currentDateStr);

    return (
        <div className="animate-fade-in space-y-4">
            {/* Date Navigation */}
            <div className="flex items-center justify-between bg-slate-800 p-3 rounded-xl border border-slate-700 mb-4 shadow-lg">
                <button onClick={() => changeCalendarDate(-1)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-300">
                    <ChevronLeft size={20} />
                </button>
                <div className="text-center">
                    <h3 className="text-white font-bold text-lg">{dashboardDate.toLocaleDateString('pt-BR')}</h3>
                    <p className="text-xs text-slate-400 uppercase tracking-widest">{DAYS_OF_WEEK[dashboardDate.getDay()]}</p>
                </div>
                <button onClick={() => changeCalendarDate(1)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-300">
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* Fixed Height Scrollable Grid Container */}
            <div className="h-[65vh] flex flex-col bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl">
                
                {/* 1. Header Row (Fixed) */}
                <div className="grid grid-cols-3 divide-x divide-slate-800 bg-slate-800 border-b border-slate-700 z-20 shadow-md">
                    {BARBERS.map(barber => {
                         const barberBookings = dayBookings.filter(b => b.barberName === barber.name && b.status !== 'cancelled');
                         const totalRevenue = barberBookings.reduce((acc, curr) => acc + curr.price, 0);
                         
                         return (
                            <div key={barber.id} className="p-3 text-center flex flex-col items-center gap-1.5">
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-slate-600">
                                        <img src={barber.avatarUrl} alt={barber.name} className="w-full h-full object-cover" />
                                    </div>
                                    <span className="absolute -bottom-1 -right-1 bg-blue-600 text-[10px] font-bold px-1.5 rounded-full border border-slate-800 text-white shadow-sm">
                                        {barberBookings.length}
                                    </span>
                                </div>
                                <div className="w-full">
                                    <h4 className="text-xs font-bold text-white truncate">{barber.name.split(' ')[0]}</h4>
                                    <p className="text-[10px] text-green-400 font-medium font-mono">R$ {totalRevenue.toFixed(0)}</p>
                                </div>
                            </div>
                         );
                    })}
                </div>

                {/* 2. Scrollable Body Row */}
                <div className="flex-1 overflow-y-auto bg-slate-900/50 scrollbar-hide md:scrollbar-default">
                    <div className="grid grid-cols-3 divide-x divide-slate-800/50 min-h-0">
                         {BARBERS.map(barber => {
                             // Pega apenas os agendamentos deste barbeiro, ordenados por hora
                             const sortedBarberBookings = dayBookings
                                .filter(b => b.barberName === barber.name && b.status !== 'cancelled')
                                .sort((a, b) => {
                                    const [hA, mA] = a.time.split(':').map(Number);
                                    const [hB, mB] = b.time.split(':').map(Number);
                                    return (hA * 60 + mA) - (hB * 60 + mB);
                                });

                             return (
                                <div key={barber.id} className="flex flex-col min-h-full p-2 gap-2">
                                    {sortedBarberBookings.length > 0 ? (
                                        sortedBarberBookings.map((slotBooking) => (
                                            <div 
                                                key={slotBooking.id}
                                                className={`
                                                    rounded-xl p-3 border shadow-md relative group overflow-hidden animate-slide-up
                                                    ${slotBooking.status === 'completed' 
                                                        ? 'bg-green-900/20 border-green-800/50' 
                                                        : 'bg-blue-900/20 border-blue-800/50'}
                                                `}
                                            >
                                                {/* Time Badge */}
                                                <div className="absolute top-2 right-2 bg-slate-900/50 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono text-slate-300">
                                                    {slotBooking.time}
                                                </div>

                                                <div className="relative z-10 pr-6">
                                                    <p className="font-bold text-white text-xs truncate leading-tight mb-0.5">
                                                        {slotBooking.userName}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400 truncate opacity-90 leading-tight">
                                                        {slotBooking.serviceName}
                                                    </p>
                                                </div>

                                                {/* Quick Actions Overlay */}
                                                <div className="absolute inset-0 bg-slate-900/90 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20 backdrop-blur-[1px]">
                                                    <button 
                                                        onClick={() => handleUpdateStatus(slotBooking.id, 'completed')}
                                                        className="p-1.5 rounded-full bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-white transition-all"
                                                        title="Concluir"
                                                    >
                                                        <Check size={14} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleContactClient(slotBooking)}
                                                        className="p-1.5 rounded-full bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white transition-all"
                                                        title="WhatsApp"
                                                    >
                                                        <MessageCircle size={14} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleUpdateStatus(slotBooking.id, 'cancelled')}
                                                        className="p-1.5 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                                                        title="Cancelar"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        // Espaço Vazio (Sem label "Livre" conforme solicitado)
                                        null
                                    )}
                                    {/* Espaço extra no final */}
                                    <div className="h-12"></div>
                                </div>
                             );
                         })}
                    </div>
                </div>
            </div>
        </div>
    );
  };

  const renderAdminDashboardStep = () => {
    const filteredBookings = getFilteredBookings();
    const financeData = getFinanceFilteredData();

    return (
    <div className="">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {/* LOGO NO PAINEL ADMIN */}
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-slate-700 shadow-lg relative z-10">
              <img src="https://i.ibb.co/FbQ2cm3v/Design-sem-nome-14.png" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white leading-none mb-1">Painel</h2>
            <div className="flex items-center gap-2">
                <p className="text-sm text-slate-400">Gerenciar</p>
                {/* Compact Shop Status Badge */}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isShopOpen 
                    ? 'bg-green-500/10 text-green-400 border-green-500/30' 
                    : 'bg-red-500/10 text-red-400 border-red-500/30'
                }`}>
                    {isShopOpen ? 'ABERTO' : 'FECHADO'}
                </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
            <button
                onClick={loadHistory}
                disabled={isLoadingDB}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700"
                title="Atualizar lista"
            >
                <RefreshCcw size={20} className={`${isLoadingDB ? 'animate-spin' : ''}`} />
            </button>

            <button
            onClick={handleGoHome}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors border border-slate-700"
            >
            Sair
            </button>
        </div>
      </div>
      
      {/* TABS */}
      <div className="flex p-1 bg-slate-800 rounded-xl mb-6 border border-slate-700/50">
        <button
            onClick={() => setAdminTab('bookings')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${adminTab === 'bookings' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
        >
            <CalendarCheck size={16} /> Agendamentos
        </button>
        <button
            onClick={() => setAdminTab('finance')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${adminTab === 'finance' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
        >
            <DollarSign size={16} /> Financeiro
        </button>
        <button
            onClick={() => setAdminTab('settings')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${adminTab === 'settings' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
        >
            <Settings size={16} /> Gerenciar
        </button>
      </div>

      {dbError && (
        <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-xl mb-6 flex items-start gap-3">
          <CloudOff className="text-red-500 shrink-0 mt-0.5" />
          <div>
             <h4 className="text-red-500 font-bold text-sm">Erro de Conexão com Supabase</h4>
             <p className="text-red-400 text-sm mt-1">{dbError}</p>
          </div>
        </div>
      )}

      {/* --- CONTENT BASED ON TAB --- */}
      
      {/* TAB: BOOKINGS (Agendamentos) */}
      {adminTab === 'bookings' && (
      <>
        {/* VIEW TOGGLE & COMPACT FILTERS */}
        <div className="bg-slate-800 border border-slate-700 p-3 rounded-xl mb-4">
            <div className="flex items-center justify-between">
                {/* View Switcher */}
                <div className="flex bg-slate-900 p-1 rounded-lg">
                    <button 
                        onClick={() => setDashboardView('list')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${dashboardView === 'list' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <List size={14} /> Lista
                    </button>
                    <button 
                        onClick={() => setDashboardView('calendar')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${dashboardView === 'calendar' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <Grid3X3 size={14} /> Grade
                    </button>
                </div>

                {/* Realtime Tiny Indicator */}
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <div className={`w-2 h-2 rounded-full ${realtimeConnected ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`}></div>
                    {realtimeConnected ? 'Online' : 'Offline'}
                </div>
            </div>

            {/* Expanded Filters for LIST VIEW */}
            {dashboardView === 'list' && (
                <div className="mt-3 pt-3 border-t border-slate-700/50 grid grid-cols-2 gap-2 animate-fade-in">
                    <div className="relative">
                        <select 
                            value={filterBarber}
                            onChange={(e) => setFilterBarber(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-lg pl-2 pr-6 py-2 appearance-none focus:border-red-500 outline-none"
                        >
                            <option value="all">Todos Barbeiros</option>
                            {BARBERS.map(b => (
                                <option key={b.id} value={b.name}>{b.name}</option>
                            ))}
                        </select>
                        <ArrowDownUp size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                    </div>
                    
                    <button 
                        onClick={() => setSortBy(prev => prev === 'created_desc' ? 'schedule_asc' : 'created_desc')}
                        className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-2 flex items-center justify-center gap-1"
                    >
                        <ArrowDownUp size={12} /> {sortBy === 'schedule_asc' ? 'Horário' : 'Recentes'}
                    </button>
                </div>
            )}
        </div>
        
        {/* RENDER CONTENT */}
        {dashboardView === 'calendar' ? (
            renderDashboardCalendar()
        ) : (
            // LIST VIEW RENDERER
            isLoadingDB ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <Loader2 className="animate-spin mb-4" size={32} />
                <p>Carregando...</p>
                </div>
            ) : filteredBookings.length === 0 ? (
                <div className="bg-slate-800/50 border border-slate-700 border-dashed rounded-2xl p-10 text-center">
                <Filter size={48} className="mx-auto text-slate-600 mb-4" />
                <h3 className="text-lg font-medium text-slate-300">Nenhum resultado</h3>
                <p className="text-slate-500 text-sm mt-1">
                    {bookingHistory.length > 0 
                        ? "Tente ajustar os filtros." 
                        : viewingLocal 
                            ? "Não há agendamentos salvos neste dispositivo." 
                            : "Os agendamentos confirmados aparecerão aqui."
                    }
                </p>
                </div>
            ) : (
                <div className="space-y-3">
                <p className="text-xs text-slate-500 text-right">
                    {filteredBookings.length} agendamentos
                </p>
                {filteredBookings.map((record) => (
                    <div key={record.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 relative group hover:border-slate-500 transition-colors animate-slide-up">
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-900/30 rounded-full flex items-center justify-center text-blue-400">
                            <User size={18} />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-base">{record.userName}</h3>
                            <div className="flex items-center gap-1 text-slate-400 text-xs">
                            <Smartphone size={10} />
                            <span>{record.userPhone}</span>
                            </div>
                        </div>
                        </div>
                        
                        <div className="flex gap-1">
                        {(record.status === 'pending' || !record.status) ? (
                            <>
                            <button 
                                onClick={() => handleUpdateStatus(record.id, 'completed')}
                                className="p-1.5 bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded-lg transition-colors"
                                title="Concluir"
                            >
                                <Check size={16} />
                            </button>
                            <button 
                                onClick={() => handleContactClient(record)}
                                className="p-1.5 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 rounded-lg transition-colors"
                                title="Enviar confirmação WhatsApp"
                            >
                                <MessageCircle size={16} />
                            </button>
                            <button 
                                onClick={() => handleUpdateStatus(record.id, 'cancelled')}
                                className="p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors"
                                title="Cancelar"
                            >
                                <X size={16} />
                            </button>
                            </>
                        ) : (
                            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${
                                record.status === 'completed' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                            }`}>
                                {record.status === 'completed' ? 'Concluído' : 'Cancelado'}
                            </span>
                        )}
                        
                        <button 
                            onClick={() => handleDeleteBooking(record.id)}
                            className="p-1.5 text-slate-500 hover:text-red-500 rounded-lg transition-colors"
                            title="Excluir"
                        >
                            <Trash2 size={16} />
                        </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-y-2 gap-x-2 text-xs border-t border-slate-700/50 pt-3">
                        <div>
                        <span className="block text-slate-500 mb-0.5">Serviço</span>
                        <span className="text-slate-200 font-medium truncate block">{record.serviceName}</span>
                        </div>
                        <div>
                        <span className="block text-slate-500 mb-0.5">Profissional</span>
                        <span className="text-slate-200 font-medium">{record.barberName}</span>
                        </div>
                        <div>
                        <span className="block text-slate-500 mb-0.5">Data/Hora</span>
                        <span className="text-white font-medium bg-slate-900 px-2 py-0.5 rounded inline-block">
                            {record.date} - {record.time}
                        </span>
                        </div>
                        <div>
                        <span className="block text-slate-500 mb-0.5">Valor</span>
                        <span className="text-green-400 font-bold">R$ {record.price.toFixed(2)}</span>
                        </div>
                    </div>
                    </div>
                ))}
                </div>
            )
        )}
      </>
      )}

      {/* TAB: FINANCEIRO */}
      {adminTab === 'finance' && (
        <div className="animate-fade-in space-y-4">
            {/* Filter Bar */}
            <div className="bg-slate-800 p-2 rounded-xl border border-slate-700 flex flex-col gap-2">
                <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                    <button
                        onClick={() => setFinanceFilter('today')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${financeFilter === 'today' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                        Hoje
                    </button>
                    <button
                        onClick={() => setFinanceFilter('7days')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${financeFilter === '7days' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                        7 Dias
                    </button>
                    <button
                        onClick={() => setFinanceFilter('30days')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${financeFilter === '30days' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                        30 Dias
                    </button>
                    <button
                        onClick={() => setFinanceFilter('custom')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${financeFilter === 'custom' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                        Personalizado
                    </button>
                </div>
                
                {financeFilter === 'custom' && (
                    <div className="flex gap-2 items-center bg-slate-900 p-2 rounded-lg animate-fade-in">
                         <div className="flex-1">
                             <span className="text-[10px] text-slate-500 block mb-0.5">Início</span>
                             <input 
                                type="date" 
                                value={customDateStart}
                                onChange={(e) => setCustomDateStart(e.target.value)}
                                className="w-full bg-slate-800 text-white text-xs p-1 rounded border border-slate-700 focus:border-blue-500 outline-none"
                             />
                         </div>
                         <div className="flex-1">
                             <span className="text-[10px] text-slate-500 block mb-0.5">Fim</span>
                             <input 
                                type="date" 
                                value={customDateEnd}
                                onChange={(e) => setCustomDateEnd(e.target.value)}
                                className="w-full bg-slate-800 text-white text-xs p-1 rounded border border-slate-700 focus:border-blue-500 outline-none"
                             />
                         </div>
                    </div>
                )}
            </div>

            {/* Cards de Resumo */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-5">
                        <DollarSign size={48} />
                    </div>
                    <p className="text-slate-400 text-[10px] uppercase font-bold mb-1 tracking-wider">Faturamento (Concluído)</p>
                    <h3 className="text-xl md:text-2xl font-bold text-green-400 truncate">
                        R$ {financeData.filter(b => b.status === 'completed').reduce((acc, curr) => acc + curr.price, 0).toFixed(2)}
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                        <CheckCircle2 size={10} /> {financeData.filter(b => b.status === 'completed').length} atendimentos
                    </p>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-5">
                        <Clock size={48} />
                    </div>
                    <p className="text-slate-400 text-[10px] uppercase font-bold mb-1 tracking-wider">Pendente (Estimado)</p>
                    <h3 className="text-xl md:text-2xl font-bold text-yellow-400 truncate">
                        R$ {financeData.filter(b => b.status === 'pending' || !b.status).reduce((acc, curr) => acc + curr.price, 0).toFixed(2)}
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                        <Clock size={10} /> {financeData.filter(b => b.status === 'pending' || !b.status).length} agendados
                    </p>
                </div>
            </div>
            
            {/* Desempenho por Barbeiro */}
            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
                    <UserCircle2 size={16} className="text-blue-400" /> Desempenho
                </h3>
                <div className="space-y-4">
                    {BARBERS.map(barber => {
                        const barberCompleted = financeData.filter(b => b.barberName === barber.name && b.status === 'completed');
                        const totalRevenue = barberCompleted.reduce((acc, curr) => acc + curr.price, 0);
                        const count = barberCompleted.length;
                        
                        // Calculate percentage for progress bar (relative to total revenue of shop)
                        const shopTotal = financeData.filter(b => b.status === 'completed').reduce((acc, curr) => acc + curr.price, 0) || 1;
                        const percentage = Math.round((totalRevenue / shopTotal) * 100);

                        return (
                            <div key={barber.id} className="relative group">
                                <div className="flex items-center justify-between mb-2 z-10 relative">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-slate-600 group-hover:border-slate-400 transition-colors">
                                            <img src={barber.avatarUrl} alt={barber.name} className="w-full h-full object-cover" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-200">{barber.name}</p>
                                            <p className="text-[10px] text-slate-500">{count} cortes • {percentage}% do total</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="block text-green-400 font-bold text-sm">R$ {totalRevenue.toFixed(2)}</span>
                                    </div>
                                </div>
                                {/* Progress Bar Background */}
                                <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                                        style={{ width: `${percentage}%` }}
                                    ></div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
            
             {/* Simple Transactions List (Last 5) */}
             <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
                    <List size={16} className="text-slate-400" /> Extrato (Filtrado)
                </h3>
                <div className="space-y-0 divide-y divide-slate-700/50">
                    {financeData
                        .filter(b => b.status === 'completed')
                        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .slice(0, 10)
                        .map(record => (
                        <div key={record.id} className="py-3 flex justify-between items-center first:pt-0 last:pb-0">
                             <div>
                                 <p className="text-xs text-white font-medium">{record.serviceName}</p>
                                 <p className="text-[10px] text-slate-500">{record.barberName} • {record.date}</p>
                             </div>
                             <span className="text-xs font-bold text-green-500">+ R$ {record.price.toFixed(2)}</span>
                        </div>
                    ))}
                    {financeData.filter(b => b.status === 'completed').length === 0 && (
                        <p className="text-center text-slate-500 text-xs py-2">Nenhum serviço concluído neste período.</p>
                    )}
                </div>
             </div>
        </div>
      )}

      {/* TAB: SETTINGS (Controle da Loja) */}
      {adminTab === 'settings' && (
      <div className="space-y-4 animate-fade-in">
          
        {/* NEW: TRANSACTION MANAGER BUTTON */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 relative overflow-hidden group hover:border-blue-500 transition-colors cursor-pointer" onClick={() => setShowTransactionManager(true)}>
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Database size={64} />
            </div>
            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 bg-blue-900/30 rounded-xl text-blue-400">
                        <FileSpreadsheet size={24} />
                    </div>
                    <h3 className="font-bold text-white text-lg">Histórico & Caixa</h3>
                </div>
                <p className="text-slate-400 text-sm max-w-[250px]">
                    Gerencie todas as transações, adicione vendas avulsas e exporte para Excel.
                </p>
            </div>
        </div>

        {/* SHOP STATUS CONTROL */}
        {isCloudEnabled && (
            <div className={`p-5 rounded-2xl border transition-all ${
                isShopOpen 
                    ? 'bg-slate-800 border-slate-700'
                    : 'bg-red-900/10 border-red-900/30'
            }`}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl ${isShopOpen ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                            <Store size={24} />
                        </div>
                        <div>
                            <h3 className={`font-bold text-lg ${isShopOpen ? 'text-white' : 'text-red-400'}`}>
                                {isShopOpen ? 'Barbearia Aberta' : 'Barbearia Fechada'}
                            </h3>
                            <p className="text-xs text-slate-500">
                                {isShopOpen ? 'Clientes agendam normalmente' : 'Novos agendamentos bloqueados'}
                            </p>
                        </div>
                    </div>
                </div>
                
                <button 
                    onClick={handleToggleShopStatus}
                    className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all ${
                        isShopOpen
                        ? 'bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500 hover:text-white'
                        : 'bg-green-500/10 text-green-500 border-green-500/30 hover:bg-green-500 hover:text-white'
                    }`}
                >
                    <Power size={18} />
                    {isShopOpen ? 'Fechar Loja Agora' : 'Abrir Loja Agora'}
                </button>
            </div>
        )}

        {/* NOTIFICATIONS CONTROL */}
        {isCloudEnabled && !viewingLocal && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <Bell size={18} /> Notificações Sonoras
            </h3>
            
            <div className="flex items-center justify-between">
                <div className="text-sm text-slate-400 max-w-[200px]">
                    Tocar som e vibrar quando chegar novo agendamento.
                </div>
                <button
                    onClick={toggleNotifications}
                    className={`p-3 rounded-xl transition-all border relative ${
                      notificationsActive 
                      ? 'bg-green-500/20 text-green-400 border-green-500/50 shadow-[0_0_10px_rgba(74,222,128,0.2)]' 
                      : 'bg-slate-900 text-slate-500 border-slate-700 hover:bg-slate-700'
                    }`}
                >
                    {notificationsActive ? <Bell size={24} /> : <BellOff size={24} />}
                </button>
            </div>
            
            {notificationsActive && (
                <button 
                    onClick={testNotification}
                    className="mt-4 w-full py-2 rounded-lg bg-slate-700 border border-slate-600 text-slate-300 text-xs font-bold hover:text-white flex items-center justify-center gap-2"
                >
                    <Volume2 size={14} /> Testar Som
                </button>
            )}
        </div>
        )}

        {/* SYSTEM STATUS */}
        <div className={`p-4 rounded-xl border flex flex-col gap-3 text-sm transition-all duration-300 ${
            isCloudEnabled && !viewingLocal
            ? (realtimeConnected ? 'bg-green-900/10 border-green-800/50' : 'bg-yellow-900/10 border-yellow-800/50')
            : 'bg-slate-800 border-slate-700'
        }`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-slate-300">
                    <Activity size={16} />
                    Status do Sistema
                </div>
                {isCloudEnabled && (
                    <button 
                        onClick={viewingLocal ? loadHistory : loadLocalHistory}
                        className="text-[10px] bg-slate-900 px-2 py-1 rounded border border-slate-700 text-slate-400 hover:text-white"
                    >
                        {viewingLocal ? 'Mudar para Nuvem' : 'Mudar para Local'}
                    </button>
                )}
            </div>
            
            <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Conexão Realtime</span>
                    <span className={realtimeConnected ? "text-green-400 font-bold" : "text-yellow-500"}>
                        {realtimeConnected ? 'CONECTADO' : 'DESCONECTADO'}
                    </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Último Sinal</span>
                    <span className="text-slate-300 font-mono">{lastSignalReceived || '-'}</span>
                </div>
                 <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Relógio Servidor</span>
                    <span className="text-slate-300 font-mono">{currentTime}</span>
                </div>
            </div>
        </div>
      </div>
      )}

      {/* FULL SCREEN TRANSACTION MANAGER OVERLAY */}
      {showTransactionManager && (
          <div className="fixed inset-0 bg-slate-900 z-50 overflow-y-auto animate-fade-in safe-area-bottom">
              <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-800 p-4 flex items-center justify-between z-10">
                  <div className="flex items-center gap-3">
                      <button onClick={() => setShowTransactionManager(false)} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                          <ChevronLeft size={20} />
                      </button>
                      <h2 className="text-lg font-bold text-white">Transações</h2>
                  </div>
                  <div className="flex gap-2">
                      <button onClick={handleExportToExcel} className="p-2 bg-green-900/20 text-green-400 border border-green-900/50 rounded-lg hover:bg-green-900/40" title="Exportar CSV">
                          <FileSpreadsheet size={20} />
                      </button>
                      <button onClick={() => setIsManualAddOpen(true)} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-900/20" title="Adicionar Manual">
                          <Plus size={20} />
                      </button>
                  </div>
              </div>

              <div className="p-4 max-w-md mx-auto">
                  {/* Search Bar */}
                  <div className="mb-4 relative">
                      <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input 
                        type="text" 
                        placeholder="Buscar por nome, serviço ou barbeiro..." 
                        value={transactionSearch}
                        onChange={(e) => setTransactionSearch(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-500 focus:border-blue-500 outline-none"
                      />
                  </div>

                  {/* Add Manual Form Collapsible */}
                  {isManualAddOpen && (
                      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-6 animate-slide-up">
                          <h3 className="text-white font-bold mb-4 flex items-center justify-between">
                              Novo Lançamento
                              <button onClick={() => setIsManualAddOpen(false)} className="text-slate-500 hover:text-white"><X size={18}/></button>
                          </h3>
                          <div className="space-y-3">
                              <div className="flex gap-2">
                                  <div className="flex-1">
                                      <label className="text-[10px] text-slate-500 uppercase font-bold">Valor (R$)*</label>
                                      <input type="number" value={manualForm.value} onChange={e => setManualForm({...manualForm, value: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white" placeholder="0.00" />
                                  </div>
                                  <div className="flex-1">
                                      <label className="text-[10px] text-slate-500 uppercase font-bold">Data</label>
                                      <input type="date" value={manualForm.date} onChange={e => setManualForm({...manualForm, date: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-sm" />
                                  </div>
                              </div>
                              <div>
                                  <label className="text-[10px] text-slate-500 uppercase font-bold">Descrição / Serviço</label>
                                  <input type="text" value={manualForm.description} onChange={e => setManualForm({...manualForm, description: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white" placeholder="Ex: Corte Avulso (Opcional)" />
                              </div>
                              <div>
                                  <label className="text-[10px] text-slate-500 uppercase font-bold">Cliente (Opcional)</label>
                                  <input type="text" value={manualForm.clientName} onChange={e => setManualForm({...manualForm, clientName: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white" placeholder="Nome do cliente" />
                              </div>
                              <div>
                                  <label className="text-[10px] text-slate-500 uppercase font-bold">Profissional</label>
                                  <select value={manualForm.barber} onChange={e => setManualForm({...manualForm, barber: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white">
                                      {BARBERS.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                                  </select>
                              </div>
                              <button 
                                onClick={handleSaveManualTransaction}
                                disabled={isSaving}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg mt-2 flex items-center justify-center gap-2"
                              >
                                  {isSaving ? <Loader2 className="animate-spin" /> : <Save size={18} />} Salvar Lançamento
                              </button>
                          </div>
                      </div>
                  )}

                  {/* List */}
                  <div className="space-y-3">
                      {bookingHistory
                        .filter(b => {
                            if (b.id === 'SHOP_STATUS_SETTINGS') return false;
                            const search = transactionSearch.toLowerCase();
                            return (
                                b.userName.toLowerCase().includes(search) || 
                                b.serviceName.toLowerCase().includes(search) ||
                                b.barberName.toLowerCase().includes(search)
                            );
                        })
                        .map(record => (
                          <div key={record.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex justify-between items-center group">
                              {editingTransaction?.id === record.id ? (
                                  // EDIT MODE
                                  <div className="w-full space-y-2">
                                      <div className="flex gap-2">
                                          <input 
                                            type="text" 
                                            value={editingTransaction.userName} 
                                            onChange={e => setEditingTransaction({...editingTransaction, userName: e.target.value})}
                                            className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                                          />
                                          <input 
                                            type="number" 
                                            value={editingTransaction.price} 
                                            onChange={e => setEditingTransaction({...editingTransaction, price: Number(e.target.value)})}
                                            className="w-20 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white font-bold"
                                          />
                                      </div>
                                      <div className="flex gap-2 justify-end">
                                          <button onClick={() => setEditingTransaction(null)} className="px-3 py-1 text-xs text-slate-400 border border-slate-600 rounded">Cancelar</button>
                                          <button onClick={handleUpdateTransaction} className="px-3 py-1 text-xs bg-blue-600 text-white rounded font-bold">Salvar</button>
                                      </div>
                                  </div>
                              ) : (
                                  // DISPLAY MODE
                                  <>
                                    <div className="flex-1 min-w-0 mr-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-white font-bold truncate">{record.userName}</span>
                                            {record.status === 'completed' && <CheckCircle2 size={12} className="text-green-500" />}
                                        </div>
                                        <p className="text-xs text-slate-400 truncate">{record.serviceName}</p>
                                        <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1">
                                            <span>{record.date}</span>
                                            <span>•</span>
                                            <span>{record.barberName}</span>
                                        </div>
                                    </div>
                                    <div className="text-right flex flex-col items-end gap-2">
                                        <span className={`font-mono font-bold ${record.status === 'cancelled' ? 'text-red-500 line-through' : 'text-green-400'}`}>
                                            R$ {record.price.toFixed(2)}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => setEditingTransaction(record)}
                                                className="p-1.5 bg-slate-700/50 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                                                title="Editar"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteBooking(record.id)}
                                                className="p-1.5 bg-red-500/10 hover:bg-red-500/20 rounded text-red-500 hover:text-red-400 transition-colors"
                                                title="Excluir"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                  </>
                              )}
                          </div>
                        ))}
                        {bookingHistory.length === 0 && <p className="text-center text-slate-500 mt-10">Nenhuma transação encontrada.</p>}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

// Progress Bar calculation
  const getProgress = () => {
    switch (booking.step) {
      case 'home': return '0%';
      case 'category': return '15%';
      case 'service': return '30%';
      case 'barber': return '45%';
      case 'datetime': return '60%';
      case 'details': return '80%';
      case 'summary': return '100%';
      default: return '0%';
    }
  };

  const isFlowStep = ['category', 'service', 'barber', 'datetime', 'details', 'summary'].includes(booking.step);

  const renderFixedFooter = () => {
    // Esconde o footer se a loja estiver fechada e o usuário estiver na Home (pois verá a tela de fechado)
    if (!isShopOpen && booking.step === 'home') return null;

    if (['home', 'category', 'admin-login', 'admin-dashboard', 'check-booking'].includes(booking.step)) return null;

    let isDisabled = false;
    let onClick = handleNextStep;
    let buttonContent = <>Continuar <ArrowRight size={20} /></>;
    let buttonClass = "";
    let subText = null;
    let totalPrice = null;

    if (booking.step === 'service') {
        isDisabled = booking.selectedServices.length === 0;
        if (booking.selectedServices.length > 0) {
            totalPrice = getTotalPrice();
        }
    } else if (booking.step === 'barber') {
        isDisabled = !booking.selectedBarber;
    } else if (booking.step === 'datetime') {
        isDisabled = !booking.selectedDate || !booking.selectedTime;
    } else if (booking.step === 'details') {
        isDisabled = booking.userName.length < 3 || booking.userPhone.length < 8 || isSaving;
        if (isSaving) {
            buttonContent = <><Loader2 className="animate-spin" size={20} /> Confirmando...</>;
        } else {
            buttonContent = <>Confirmar Agendamento <ArrowRight size={20} /></>;
        }
    } else if (booking.step === 'summary') {
        onClick = sendToWhatsApp;
        buttonContent = <><MessageCircle size={24} /> Enviar para WhatsApp</>;
        buttonClass = "bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-green-900/20";
        subText = "Clique para enviar os detalhes ao seu barbeiro.";
    }

    // Default button class if not set
    if (!buttonClass) {
        buttonClass = isDisabled 
            ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
            : 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20';
    }

    return (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 z-50 flex justify-center flex-col items-center safe-area-bottom">
            <div className="w-full max-w-md">
                {totalPrice !== null && (
                    <div className="flex justify-between items-center mb-3 px-1">
                        <span className="text-slate-400 text-sm">{booking.selectedServices.length} selecionado(s)</span>
                        <span className="text-white font-bold text-lg">Total: R$ {totalPrice.toFixed(2)}</span>
                    </div>
                )}
                <button
                    onClick={onClick}
                    disabled={isDisabled && booking.step !== 'summary'}
                    className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${buttonClass}`}
                >
                    {buttonContent}
                </button>
                {subText && (
                    <p className="text-xs text-slate-500 mt-3 text-center">
                        {subText}
                    </p>
                )}
            </div>
        </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 pb-10">
      <Header onHomeClick={handleGoHome} onAdminClick={handleAdminAccess} />

      {/* Global In-App Notification */}
      {toast && (
        <div className="fixed top-0 left-0 right-0 flex justify-center z-[9999] p-4 pointer-events-none">
            <div className="bg-slate-900/95 backdrop-blur-xl border border-red-600/40 shadow-[0_10px_40px_-10px_rgba(220,38,38,0.5)] rounded-2xl p-4 flex items-center gap-4 w-full max-w-sm pointer-events-auto animate-slide-up transform transition-all ring-1 ring-white/10">
                <button 
                  onClick={() => setToast(null)}
                  className="absolute top-2 right-2 text-slate-500 hover:text-white transition-colors"
                >
                    <XCircle size={18} />
                </button>
                
                <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-full bg-slate-800 border-2 border-red-600 overflow-hidden shadow-lg">
                        <img src="https://i.ibb.co/FbQ2cm3v/Design-sem-nome-14.png" className="w-full h-full object-cover" alt="Logo" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-green-500 border-2 border-slate-900 w-4 h-4 rounded-full animate-pulse"></div>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-bold text-white text-sm leading-tight tracking-wide uppercase">{toast.title}</h3>
                        <span className="text-[10px] bg-red-600/20 text-red-400 px-1.5 rounded font-bold">AGORA</span>
                    </div>
                    <p className="text-slate-200 text-sm font-medium leading-snug truncate">{toast.message}</p>
                    {toast.subtext && (
                        <p className="text-slate-500 text-xs mt-0.5 flex items-center gap-1">
                            <Clock size={10} /> {toast.subtext}
                        </p>
                    )}
                </div>
            </div>
        </div>
      )}
      
      <main className="max-w-md mx-auto p-6">
        {isFlowStep && (
          <div className="h-1 bg-slate-800 rounded-full mb-8 overflow-hidden animate-fade-in">
            <div 
              className="h-full bg-blue-600 transition-all duration-500 ease-out"
              style={{ width: getProgress() }}
            ></div>
          </div>
        )}

        {/* Mostrar botão Voltar se não for Home e não for uma das etapas onde o Header já tem função Home */}
        {booking.step !== 'home' && booking.step !== 'summary' && (
          <button 
            onClick={handleBackStep}
            className="mb-4 text-slate-400 hover:text-white flex items-center gap-1 text-sm font-medium transition-colors"
          >
            <ChevronLeft size={16} /> Voltar
          </button>
        )}

        <div 
          key={booking.step}
          className="animate-slide-up"
        >
          {booking.step === 'home' && renderHomeStep()}
          {booking.step === 'check-booking' && renderCheckBookingStep()}
          {booking.step === 'category' && renderCategoryStep()}
          {booking.step === 'service' && renderServiceStep()}
          {booking.step === 'barber' && renderBarberStep()}
          {booking.step === 'datetime' && renderDateTimeStep()}
          {booking.step === 'details' && renderDetailsStep()}
          {booking.step === 'summary' && renderSummaryStep()}
          {booking.step === 'admin-login' && renderAdminLoginStep()}
          {booking.step === 'admin-dashboard' && renderAdminDashboardStep()}
        </div>
      </main>
      
      {/* Footer fixo renderizado fora do main container */}
      {renderFixedFooter()}
    </div>
  );
};

export default App;
