
import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { ServiceCard } from './components/ServiceCard';
import { BookingState, BookingRecord, ServiceCategory, Service } from './types';
import { SERVICES, TIME_SLOTS, DAYS_OF_WEEK, BARBER_PHONE, BARBERS } from './constants';
import { bookingService } from './services/bookingService';
import { isSupabaseConfigured, supabase } from './services/supabase';
import { Calendar, ChevronLeft, ChevronRight, ArrowRight, CheckCircle2, MessageCircle, Clock, User, Scissors, MapPin, Instagram, Phone, Lock, LogIn, LayoutDashboard, Smartphone, Check, X, Sparkles, UserCircle2, Trash2, Loader2, CloudOff, Cloud, Database, RefreshCcw, Bell, BellOff, Volume2, XCircle, Activity, Download, Wifi, Search, CalendarCheck, Ban, Filter, DollarSign, ArrowDownUp, SlidersHorizontal, Store, Power, List, Grid3X3, Settings } from 'lucide-react';

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
  const [adminTab, setAdminTab] = useState<'bookings' | 'settings'>('bookings');

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
    setBookingHistory(prev => prev.map(record => 
        record.id === id ? { ...record, status: newStatus } : record
    ));
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
              onClick={() => updateBooking({ selectedBarber: barber })}
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
              type="password"
              value={adminCredentials.password}
              onChange={(e) => setAdminCredentials(prev => ({ ...prev, password: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              placeholder="Digite sua senha"
             />
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
            <div className="flex items-center justify-between bg-slate-800 p-3 rounded-xl border border-slate-700 mb-4">
                <button onClick={() => changeCalendarDate(-1)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-300">
                    <ChevronLeft size={20} />
                </button>
                <div className="text-center">
                    <h3 className="text-white font-bold text-lg">{dashboardDate.toLocaleDateString('pt-BR')}</h3>
                    <p className="text-xs text-slate-400 uppercase">{DAYS_OF_WEEK[dashboardDate.getDay()]}</p>
                </div>
                <button onClick={() => changeCalendarDate(1)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-300">
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* Calendar Grid */}
            <div className="overflow-x-auto pb-4">
                <div className="min-w-[600px] md:min-w-full grid grid-cols-3 gap-2">
                    {BARBERS.map(barber => (
                        <div key={barber.id} className="flex flex-col gap-2">
                            {/* Barber Header */}
                            <div className="bg-slate-800 p-2 rounded-lg border border-slate-700 text-center sticky top-0 z-10 shadow-lg">
                                <div className="w-8 h-8 rounded-full overflow-hidden mx-auto mb-1 border border-slate-600">
                                    <img src={barber.avatarUrl} alt={barber.name} className="w-full h-full object-cover" />
                                </div>
                                <h4 className="text-xs font-bold text-slate-200 truncate">{barber.name.split(' ')[0]}</h4>
                            </div>

                            {/* Time Slots */}
                            <div className="space-y-2">
                                {TIME_SLOTS.map(time => {
                                    // Find booking for this slot
                                    const slotBooking = dayBookings.find(b => 
                                        b.barberName === barber.name && 
                                        b.time === time && 
                                        b.status !== 'cancelled'
                                    );

                                    return (
                                        <div 
                                            key={`${barber.id}-${time}`} 
                                            className={`p-2 rounded-lg border text-xs min-h-[60px] flex flex-col justify-center relative ${
                                                slotBooking 
                                                ? (slotBooking.status === 'completed' ? 'bg-green-900/20 border-green-800' : 'bg-red-900/20 border-red-800')
                                                : 'bg-slate-900/50 border-slate-800 text-slate-600'
                                            }`}
                                        >
                                            <span className="absolute top-1 right-2 opacity-50 text-[10px] font-mono">{time}</span>
                                            
                                            {slotBooking ? (
                                                <>
                                                    <p className="font-bold text-white truncate">{slotBooking.userName}</p>
                                                    <p className="text-[10px] text-slate-400 truncate">{slotBooking.serviceName}</p>
                                                    <div className="mt-1 flex gap-1">
                                                       {/* Quick Actions for Calendar View */}
                                                        <button 
                                                            onClick={() => handleUpdateStatus(slotBooking.id, 'completed')}
                                                            className="p-1 bg-slate-800 rounded hover:text-green-500"
                                                            title="Concluir"
                                                        >
                                                            <Check size={10} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleUpdateStatus(slotBooking.id, 'cancelled')}
                                                            className="p-1 bg-slate-800 rounded hover:text-red-500"
                                                            title="Cancelar"
                                                        >
                                                            <X size={10} />
                                                        </button>
                                                    </div>
                                                </>
                                            ) : (
                                                <span className="text-center">-</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
  };

  const renderAdminDashboardStep = () => {
    const filteredBookings = getFilteredBookings();

    return (
    <div className="">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-red-600/20 rounded-xl flex items-center justify-center text-red-500 border border-red-600/30">
            <LayoutDashboard size={24} />
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
            onClick={() => setAdminTab('settings')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${adminTab === 'settings' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
        >
            <Settings size={16} /> Gerenciar Loja
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

      {/* TAB: SETTINGS (Controle da Loja) */}
      {adminTab === 'settings' && (
      <div className="space-y-4 animate-fade-in">
          
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
    </div>
  );
  }

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
