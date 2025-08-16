import React, { useState, useEffect, useRef } from 'react';
import {
    Home, List, Users, BarChart2, Plus, Edit, Trash2, Download, Calendar, Search, Info, DollarSign, Droplet, Percent, Package, Factory, ChevronDown, ChevronUp, XCircle, CheckCircle, Settings, Coins, LogOut, Leaf, AlertCircle, ShoppingBag
} from 'lucide-react';
import Login from "./Login";
import { auth } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

// Mock functions for readData and writeData to allow the app to run
const mockData = {
    customers: [],
    transactions: [],
    workerExpenses: [],
    factoryOverhead: [],
    pomaceRevenues: [],
    tinPurchases: [],
    plasticPurchases: [],
    oilPurchases: [], // Zeytinyağı alımları için boş bir dizi
    oilSales: [], // Zeytinyağı satışları için boş bir dizi
    defaultPrices: {
        pricePerKg: 3,
        tinPrices: { s16: 80, s10: 70, s5: 60 },
        plasticPrices: { s10: 20, s5: 15, s2: 10 },
        oilPurchasePrice: 200,
        oilSalePrice: 250
    }
};

const readData = async () => {
    console.log("Reading mock data");
    const savedData = localStorage.getItem('safDamlaData');
    if (savedData) {
        return JSON.parse(savedData);
    }
    return mockData;
};

const writeData = async (data) => {
    console.log("Writing mock data");
    localStorage.setItem('safDamlaData', JSON.stringify(data));
};


// Helper function for number formatting
const formatNumber = (value, unit = '') => {
  const number = Number(value);

  if (isNaN(number) || value === '' || value === null) {
      const emptyValue = unit === '₺' ? '0 ₺' : '0';
      return unit ? emptyValue : '0';
  }

  const formatted = new Intl.NumberFormat('tr-TR', {
      maximumFractionDigits: 2
  }).format(number);

  return unit ? `${formatted} ${unit}` : formatted;
};



// Helper function for oil ratio formatting
const formatOilRatioDisplay = (oliveKg, oilLitre) => {
  const numOliveKg = Number(oliveKg);
  const numOilLitre = Number(oilLitre);

  if (numOliveKg > 0 && numOilLitre > 0) {
    const ratio = (numOliveKg / numOilLitre).toFixed(2);
    return `${formatNumber(numOliveKg)} kg zeytin / ${formatNumber(numOilLitre)} litre yağ = ${ratio}`;
  }
  return 'N/A';
};

// Helper function to round numbers to two decimal places to avoid floating point issues
const roundToTwo = (num) => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

// Helper function to safely format a Date object or string into YYYY-MM-DD format for date inputs
const toInputDateString = (date) => {
  try {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    // The toISOString() method can cause timezone issues.
    // Manually building the string is safer.
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    console.error("Error formatting date:", e);
    return '';
  }
};

// Detaylı teneke istatistik fonksiyonu
function calculateDetailedTinStatistics(tinPurchases) {
  const stats = {
    s16: { toplam_adet: 0, toplam_maliyet: 0, ortalama_birim_fiyat: 0 },
    s10: { toplam_adet: 0, toplam_maliyet: 0, ortalama_birim_fiyat: 0 },
    s5: { toplam_adet: 0, toplam_maliyet: 0, ortalama_birim_fiyat: 0 },
  };
  tinPurchases.forEach(p => {
    const adet16 = Number(p.s16) || 0;
    const adet10 = Number(p.s10) || 0;
    const adet5 = Number(p.s5) || 0;
    const birimFiyat = Number(p.tinPrice) || 0;
    stats.s16.toplam_adet += adet16;
    stats.s10.toplam_adet += adet10;
    stats.s5.toplam_adet += adet5;
    stats.s16.toplam_maliyet += adet16 * birimFiyat;
    stats.s10.toplam_maliyet += adet10 * birimFiyat;
    stats.s5.toplam_maliyet += adet5 * birimFiyat;
  });
  ['s16','s10','s5'].forEach(key => {
    stats[key].ortalama_birim_fiyat = stats[key].toplam_adet > 0 ? (stats[key].toplam_maliyet / stats[key].toplam_adet) : 0;
  });
  return stats;
}

// Yeni veri yapısına uygun teneke kar/zarar hesaplama fonksiyonu
function calculateTinProfitLoss(tinPurchases, transactions) {
  // 1. Ortalama alım maliyetini hesapla
  const alinan = { s16: 0, s10: 0, s5: 0 };
  const alinanMaliyet = { s16: 0, s10: 0, s5: 0 };
  tinPurchases.forEach(p => {
    const adet16 = Number(p.s16) || 0;
    const adet10 = Number(p.s10) || 0;
    const adet5 = Number(p.s5) || 0;
    const birimFiyat = Number(p.tinPrice) || 0;
    alinan.s16 += adet16;
    alinan.s10 += adet10;
    alinan.s5 += adet5;
    alinanMaliyet.s16 += adet16 * birimFiyat;
    alinanMaliyet.s10 += adet10 * birimFiyat;
    alinanMaliyet.s5 += adet5 * birimFiyat;
  });
  const ortMaliyet = {
    s16: alinan.s16 > 0 ? alinanMaliyet.s16 / alinan.s16 : 0,
    s10: alinan.s10 > 0 ? alinanMaliyet.s10 / alinan.s10 : 0,
    s5:  alinan.s5  > 0 ? alinanMaliyet.s5  / alinan.s5  : 0,
  };
  // 2. Toplam satış adedi ve geliri
  const satilan = { s16: 0, s10: 0, s5: 0 };
  const satisGeliri = { s16: 0, s10: 0, s5: 0 };
  transactions.forEach(t => {
    satilan.s16 += Number(t.tinCounts?.s16 || 0);
    satilan.s10 += Number(t.tinCounts?.s10 || 0);
    satilan.s5  += Number(t.tinCounts?.s5  || 0);
    satisGeliri.s16 += (Number(t.tinCounts?.s16 || 0) * Number(t.tinPrices?.s16 || 0));
    satisGeliri.s10 += (Number(t.tinCounts?.s10 || 0) * Number(t.tinPrices?.s10 || 0));
    satisGeliri.s5  += (Number(t.tinCounts?.s5  || 0) * Number(t.tinPrices?.s5  || 0));
  });
  // 3. Satılan malların maliyeti (SMM)
  const smm = {
    s16: satilan.s16 * ortMaliyet.s16,
    s10: satilan.s10 * ortMaliyet.s10,
    s5:  satilan.s5  * ortMaliyet.s5,
  };
  // 4. Net kar
  const netKar = {
    s16: satisGeliri.s16 - smm.s16,
    s10: satisGeliri.s10 - smm.s10,
    s5:  satisGeliri.s5  - smm.s5,
  };
  // Genel toplamlar
  const toplamSatisGeliri = satisGeliri.s16 + satisGeliri.s10 + satisGeliri.s5;
  const toplamSMM = smm.s16 + smm.s10 + smm.s5;
  const toplamNetKar = netKar.s16 + netKar.s10 + netKar.s5;
  return {
    detay: { s16: { ...satilan, gelir: satisGeliri.s16, smm: smm.s16, netKar: netKar.s16 }, s10: { ...satilan, gelir: satisGeliri.s10, smm: smm.s10, netKar: netKar.s10 }, s5: { ...satilan, gelir: satisGeliri.s5, smm: smm.s5, netKar: netKar.s5 } },
    toplamSatisGeliri,
    toplamSMM,
    toplamNetKar,
  };
}

function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthChecked(true);
    });
    return () => unsubscribe();
  }, []);

  if (!authChecked) {
    return <div>Yükleniyor...</div>;
  }

  if (!user) {
    return <Login onLogin={() => setUser(auth.currentUser)} />;
  }

  // All useState declarations grouped at the very top
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [customers, setCustomers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showNewTransactionModal, setShowNewTransactionModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userId, setUserId] = useState(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [confirmationAction, setConfirmationAction] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // States for Factory Expenses page and Default Prices
  const [workerExpenses, setWorkerExpenses] = useState([]);
  const [factoryOverhead, setFactoryOverhead] = useState([]);
  const [pomaceRevenues, setPomaceRevenues] = useState([]);
  const [tinPurchases, setTinPurchases] = useState([]);
  const [plasticPurchases, setPlasticPurchases] = useState([]); // New state for plastic jug purchases
  const [oilPurchases, setOilPurchases] = useState([]); // Zeytinyağı alımları için boş bir dizi
  const [oilSales, setOilSales] = useState([]); // Zeytinyağı satışları için boş bir dizi

  const [defaultPrices, setDefaultPrices] = useState({
    pricePerKg: 3,
    tinPrices: { s16: 80, s10: 70, s5: 60 },
    plasticPrices: { s10: 20, s5: 15, s2: 10 },
    oilPurchasePrice: 200,
    oilSalePrice: 250
  });


  // Initialize Firebase and set up authentication


  useEffect(() => {
    async function fetchData() {
      const data = await readData();
      setCustomers(data.customers || []);
      setTransactions(data.transactions || []);
      setWorkerExpenses(data.workerExpenses || []);
      setFactoryOverhead(data.factoryOverhead || []);
      setPomaceRevenues(data.pomaceRevenues || []);
      setTinPurchases(data.tinPurchases || []);
      setPlasticPurchases(data.plasticPurchases || []);
      setOilPurchases(data.oilPurchases || []); // Yeni state'i yükle
      setOilSales(data.oilSales || []); // Yeni state'i yükle
      setDefaultPrices(data.defaultPrices || {
        pricePerKg: 3,
        tinPrices: { s16: 80, s10: 70, s5: 60 },
        plasticPrices: { s10: 20, s5: 15, s2: 10 },
        oilPurchasePrice: 200,
        oilSalePrice: 250
      });
    }
    fetchData();
  }, []);

  const showMessage = (msg, type) => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 3000);
  };

  const navigateTo = (page, data = null) => {
    setCurrentPage(page);
    if (page === 'customerDetails') {
      setSelectedCustomer(data);
    } else {
      setSelectedCustomer(null);
    }
  };

  const handleOpenNewTransactionModal = (transaction = null) => {
    setEditingTransaction(transaction);
    setShowNewTransactionModal(true);
  };

  const handleCloseNewTransactionModal = () => {
    setShowNewTransactionModal(false);
    setEditingTransaction(null);
  };
  
  const handleSaveDefaultPrices = async (newPrices) => {
    try {
      const data = await readData();
      data.defaultPrices = newPrices;
      await writeData(data);
      setDefaultPrices(newPrices);
      showMessage('Varsayılan fiyatlar başarıyla kaydedildi!', 'success');
    } catch (error) {
      console.error('Error saving default prices:', error);
      showMessage('Varsayılan fiyatlar kaydedilirken hata oluştu!', 'error');
    }
  };

  // Müşteri ekleme/güncelleme
  const handleSaveCustomer = async (customerData) => {
    try {
      const data = await readData();
      let customers = data.customers || [];
      if (customerData.id) {
        customers = customers.map(c => c.id === customerData.id ? { ...c, ...customerData } : c);
        showMessage('Müşteri başarıyla güncellendi!', 'success');
      } else {
        customerData.id = Date.now().toString();
        customerData.createdAt = new Date().toISOString();
        customers.push(customerData);
        showMessage('Müşteri başarıyla eklendi!', 'success');
      }
      data.customers = customers;
      await writeData(data);
      setCustomers(customers);
    } catch (error) {
      console.error('Error saving customer:', error);
      showMessage('Müşteri kaydedilirken hata oluştu!', 'error');
    }
  };

  // İşlem ekleme/güncelleme
  const handleSaveTransaction = async (transactionData) => {
    try {
      const data = await readData();
      let transactions = data.transactions || [];
      let customerId = transactionData.customerId;
      if (!customerId) {
        const existingCustomer = customers.find(c => c.name.toLowerCase() === transactionData.customerName.toLowerCase());
        if (existingCustomer) {
          customerId = existingCustomer.id;
        } else {
          const newCustomer = {
            id: Date.now().toString(),
            name: transactionData.customerName,
            phone: '',
            address: '',
            createdAt: new Date().toISOString()
          };
          data.customers = [...(data.customers || []), newCustomer];
          customerId = newCustomer.id;
          setCustomers(data.customers);
        }
      }
      const transactionToSave = {
        ...transactionData,
        customerId,
        customerName: transactionData.customerName,
        date: transactionData.date.toISOString(),
        id: transactionData.id || Date.now().toString()
      };
      if (transactionData.id) {
        transactions = transactions.map(t => t.id === transactionData.id ? transactionToSave : t);
        showMessage('İşlem başarıyla güncellendi!', 'success');
      } else {
        transactions.push(transactionToSave);
        showMessage('İşlem başarıyla eklendi!', 'success');
      }
      data.transactions = transactions;
      await writeData(data);
      setTransactions(transactions);
      handleCloseNewTransactionModal();
    } catch (error) {
      console.error('Error saving transaction:', error);
      showMessage('İşlem kaydedilirken hata oluştu!', 'error');
    }
  };

  // Tahsilat işlemi
  const handleCollectPayment = async (customerId, customerName, amount) => {
    try {
      const data = await readData();
      let transactions = data.transactions || [];
      const paymentTransaction = {
        id: Date.now().toString(),
        customerId,
        customerName,
        date: new Date().toISOString(),
        paymentReceived: Number(amount),
        oliveKg: 0,
        oilLitre: 0,
        pricePerKg: 0,
        tinCounts: { s16: 0, s10: 0, s5: 0 },
        tinPrices: { s16: 0, s10: 0, s5: 0 },
        plasticCounts: { s10: 0, s5: 0, s2: 0 },
        plasticPrices: { s10: 0, s5: 0, s2: 0 },
        totalCost: 0,
        oilRatio: 0,
        paymentLoss: 0,
        remainingBalance: -Number(amount),
        description: 'Ara Tahsilat'
      };
      transactions.push(paymentTransaction);
      data.transactions = transactions;
      await writeData(data);
      setTransactions(transactions);
      showMessage(`${formatNumber(amount, '₺')} tutarında tahsilat başarıyla kaydedildi.`, 'success');
    } catch (error) {
      console.error('Error collecting payment:', error);
      showMessage('Tahsilat sırasında hata oluştu!', 'error');
    }
  };
  
  // Zeytinyağı alım kaydetme
  const handleSaveOilPurchase = async (purchaseData) => {
    try {
      const data = await readData();
      let oilPurchases = data.oilPurchases || [];
      if (purchaseData.id) {
        oilPurchases = oilPurchases.map(p => p.id === purchaseData.id ? { ...p, ...purchaseData } : p);
        showMessage('Zeytinyağı alımı başarıyla güncellendi!', 'success');
      } else {
        purchaseData.id = Date.now().toString();
        purchaseData.createdAt = new Date().toISOString();
        oilPurchases.push(purchaseData);
        showMessage('Zeytinyağı alımı başarıyla eklendi!', 'success');
      }
      data.oilPurchases = oilPurchases;
      await writeData(data);
      setOilPurchases(oilPurchases);
    } catch (error) {
      console.error('Error saving oil purchase:', error);
      showMessage('Zeytinyağı alımı kaydedilirken hata oluştu!', 'error');
    }
  };

  // Zeytinyağı satım kaydetme
  const handleSaveOilSale = async (saleData) => {
    try {
      const data = await readData();
      let oilSales = data.oilSales || [];
      if (saleData.id) {
        oilSales = oilSales.map(s => s.id === saleData.id ? { ...s, ...saleData } : s);
        showMessage('Zeytinyağı satışı başarıyla güncellendi!', 'success');
      } else {
        saleData.id = Date.now().toString();
        saleData.createdAt = new Date().toISOString();
        oilSales.push(saleData);
        showMessage('Zeytinyağı satışı başarıyla eklendi!', 'success');
      }
      data.oilSales = oilSales;
      await writeData(data);
      setOilSales(oilSales);
    } catch (error) {
      console.error('Error saving oil sale:', error);
      showMessage('Zeytinyağı satışı kaydedilirken hata oluştu!', 'error');
    }
  };

  // Giderler ve diğer veri işlemleri için benzer fonksiyonlar
  const handleSaveWorkerExpense = async (expenseData) => {
    try {
      const data = await readData();
      let workerExpenses = data.workerExpenses || [];
      if (expenseData.id) {
        workerExpenses = workerExpenses.map(e => e.id === expenseData.id ? { ...e, ...expenseData } : e);
        showMessage('İşçi harcaması başarıyla güncellendi!', 'success');
      } else {
        expenseData.id = Date.now().toString();
        expenseData.createdAt = new Date().toISOString();
        workerExpenses.push(expenseData);
        showMessage('İşçi harcaması başarıyla eklendi!', 'success');
      }
      data.workerExpenses = workerExpenses;
      await writeData(data);
      setWorkerExpenses(workerExpenses);
    } catch (error) {
      console.error('Error saving worker expense:', error);
      showMessage('İşçi harcaması kaydedilirken hata oluştu!', 'error');
    }
  };

  const handleSaveFactoryOverhead = async (overheadData) => {
    try {
      const data = await readData();
      let factoryOverhead = data.factoryOverhead || [];
      if (overheadData.id) {
        factoryOverhead = factoryOverhead.map(e => e.id === overheadData.id ? { ...e, ...overheadData } : e);
        showMessage('Muhtelif gider başarıyla güncellendi!', 'success');
      } else {
        overheadData.id = Date.now().toString();
        overheadData.createdAt = new Date().toISOString();
        factoryOverhead.push(overheadData);
        showMessage('Muhtelif gider başarıyla eklendi!', 'success');
      }
      data.factoryOverhead = factoryOverhead;
      await writeData(data);
      setFactoryOverhead(factoryOverhead);
    } catch (error) {
      console.error('Error saving factory overhead:', error);
      showMessage('Muhtelif gider kaydedilirken hata oluştu!', 'error');
    }
  };

  const handleSavePomaceRevenue = async (revenueData) => {
    try {
      const data = await readData();
      let pomaceRevenues = data.pomaceRevenues || [];
      if (revenueData.id) {
        pomaceRevenues = pomaceRevenues.map(e => e.id === revenueData.id ? { ...e, ...revenueData } : e);
        showMessage('Pirina geliri başarıyla güncellendi!', 'success');
      } else {
        revenueData.id = Date.now().toString();
        revenueData.createdAt = new Date().toISOString();
        pomaceRevenues.push(revenueData);
        showMessage('Pirina geliri başarıyla eklendi!', 'success');
      }
      data.pomaceRevenues = pomaceRevenues;
      await writeData(data);
      setPomaceRevenues(pomaceRevenues);
    } catch (error) {
      console.error('Error saving pomace revenue:', error);
      showMessage('Pirina geliri kaydedilirken hata oluştu!', 'error');
    }
  };

  const handleSaveTinPurchase = async (purchaseData) => {
    try {
      const data = await readData();
      let tinPurchases = data.tinPurchases || [];
      if (purchaseData.id) {
        tinPurchases = tinPurchases.map(e => e.id === purchaseData.id ? { ...e, ...purchaseData } : e);
        showMessage('Teneke alımı başarıyla güncellendi!', 'success');
      } else {
        purchaseData.id = Date.now().toString();
        purchaseData.createdAt = new Date().toISOString();
        tinPurchases.push(purchaseData);
        showMessage('Teneke alımı başarıyla eklendi!', 'success');
      }
      data.tinPurchases = tinPurchases;
      await writeData(data);
      setTinPurchases(tinPurchases);
    } catch (error) {
      console.error('Error saving tin purchase:', error);
      showMessage('Teneke alımı kaydedilirken hata oluştu!', 'error');
    }
  };

  const handleSavePlasticPurchase = async (purchaseData) => {
    try {
      const data = await readData();
      let plasticPurchases = data.plasticPurchases || [];
      if (purchaseData.id) {
        plasticPurchases = plasticPurchases.map(e => e.id === purchaseData.id ? { ...e, ...purchaseData } : e);
        showMessage('Bidon alımı başarıyla güncellendi!', 'success');
      } else {
        purchaseData.id = Date.now().toString();
        purchaseData.createdAt = new Date().toISOString();
        plasticPurchases.push(purchaseData);
        showMessage('Bidon alımı başarıyla eklendi!', 'success');
      }
      data.plasticPurchases = plasticPurchases;
      await writeData(data);
      setPlasticPurchases(plasticPurchases);
    } catch (error) {
      console.error('Error saving plastic purchase:', error);
      showMessage('Bidon alımı kaydedilirken hata oluştu!', 'error');
    }
  };

// Silme işlemleri
const handleDeleteItem = async (collectionName, id) => {
  try {
    const data = await readData();
    let collection = data[collectionName] || [];
    collection = collection.filter(item => item.id !== id);
    data[collectionName] = collection;
    await writeData(data);
    // State güncelle
    switch (collectionName) {
      case 'transactions': setTransactions(collection); break;
      case 'workerExpenses': setWorkerExpenses(collection); break;
      case 'factoryOverhead': setFactoryOverhead(collection); break;
      case 'pomaceRevenues': setPomaceRevenues(collection); break;
      case 'tinPurchases': setTinPurchases(collection); break;
      case 'plasticPurchases': setPlasticPurchases(collection); break;
      case 'oilPurchases': setOilPurchases(collection); break; // Yeni eklendi
      case 'oilSales': setOilSales(collection); break; // Yeni eklendi
      default: break;
    }
    showMessage('Kayıt başarıyla silindi.', 'success');
  } catch (error) {
    console.error('Error deleting item:', error);
    showMessage('Silme işlemi sırasında hata oluştu!', 'error');
  }
};

const handleDeleteSingleCustomer = async (customerId) => {
  try {
    const data = await readData();
    let customers = data.customers || [];
    let transactions = data.transactions || [];
    customers = customers.filter(c => c.id !== customerId);
    transactions = transactions.filter(t => t.customerId !== customerId);
    data.customers = customers;
    data.transactions = transactions;
    await writeData(data);
    setCustomers(customers);
    setTransactions(transactions);
    showMessage('Müşteri ve tüm işlemleri başarıyla silindi.', 'success');
  } catch (error) {
    console.error('Error deleting customer:', error);
    showMessage('Müşteri silme işlemi sırasında hata oluştu!', 'error');
  }
};

const confirmDelete = async () => {
  if (!confirmationAction) return;
  const { type, id, ids, collection: collectionName } = confirmationAction;
  setIsDeleting(true); // Silme işlemi başladı
  try {
    if (type === 'delete-single-item') {
      await handleDeleteItem(collectionName, id);
    } else if (type === 'delete-single-customer') {
      await handleDeleteSingleCustomer(id);
      showMessage(`1 müşteri ve tüm işlemleri başarıyla silindi.`, 'success');
      navigateTo('customers');
    } else if (type === 'delete-multiple-customers') {
      // Tüm müşterileri sırayla sil
      for (const customerId of ids) {
        await handleDeleteSingleCustomer(customerId);
      }
      showMessage(`${ids.length} müşteri ve tüm işlemleri başarıyla silindi.`, 'success');
      navigateTo('customers');
    }
  } catch (error) {
    console.error('Silme hatası:', error);
    showMessage(`Silme hatası: ${error.message}`, 'error');
  } finally {
    setIsDeleting(false); // Silme işlemi bitti
    setShowConfirmationModal(false);
    setConfirmationAction(null);
  }
};

const handleDeleteSelectedCustomers = (customerIds) => {
  const message = `${customerIds.length} müşteriyi ve bu müşterilere ait tüm işlemleri kalıcı olarak silmek istediğinizden emin misiniz?`;
  setConfirmationAction({ type: 'delete-multiple-customers', ids: customerIds, message });
  setShowConfirmationModal(true);
};

// useEffect'lerden sonra koşullu return


// Eğer giriş ekranı istemiyorsan aşağıdaki user kontrolünü kaldırabilirsin
/*
if (!user) {
  return <Login onLogin={() => {}} />;
}
*/

  // Otomatik yedekleme zamanlayıcı
  React.useEffect(() => {
    let timer;
    async function doBackup() {
      // Electron-specific ipcRenderer code is removed for web compatibility
      // You might replace this with a different backup mechanism for the web
      console.log("Attempting automatic backup...");
      try {
        const data = await readData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        // This won't automatically download in the browser without user interaction.
        // It's logged to the console to show the backup would happen.
        console.log("Backup data prepared:", blob);
        // showMessage('Otomatik yedekleme verisi oluşturuldu (konsola bakın).', 'success');
      } catch (err) {
        // showMessage('Otomatik yedekleme sırasında hata oluştu!', 'error');
        console.error("Backup error:", err);
      }
    }
    // İlk açılışta hemen yedekle
    doBackup();
    // Sonra her 24 saatte bir yedekle
    timer = setInterval(doBackup, 24 * 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

return (
  <div className="min-h-screen bg-gray-50 font-inter flex flex-col">
    {/* ÜST HEADER */}
    <header className="relative w-full bg-white shadow-md z-10">
      <nav className="flex items-center justify-between px-6 py-3">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-emerald-700">DÜLDÜL ZEYTİNYAĞI FABRİKASI</h1>
          <div className="flex items-center space-x-2">
            <NavItem 
                text="Ana Sayfa" 
                icon={<Home />} 
                active={currentPage === 'dashboard'} 
                onClick={() => navigateTo('dashboard')}
                textClassName="text-sm"
            />
            <NavItem text="Kayıtlar" icon={<List />} active={currentPage === 'records'} onClick={() => navigateTo('records')} />
            <NavItem text="Müşteriler" icon={<Users />} active={currentPage === 'customers'} onClick={() => navigateTo('customers')} />
            <NavItem 
                text="Zeytinyağı Alım/Satım" // Yeni menü öğesi
                icon={<ShoppingBag />} 
                active={currentPage === 'oilTrading'} 
                onClick={() => navigateTo('oilTrading')}
                textClassName="text-xs"
            />
            <NavItem 
                text="Giderler ve Diğer Gelirler" 
                icon={<Factory />} 
                active={currentPage === 'expenses'} 
                onClick={() => navigateTo('expenses')}
                textClassName="text-xs"
            />
            <NavItem text="İstatistikler" icon={<BarChart2 />} active={currentPage === 'statistics'} onClick={() => navigateTo('statistics')} />
            <NavItem text="Stoğumuz" icon={<Package />} active={currentPage === 'stock'} onClick={() => navigateTo('stock')} />
            <NavItem text="Yedekler" icon={<Download />} active={currentPage === 'backup'} onClick={() => navigateTo('backup')} />
          </div>
        </div>
      </nav>
    </header>
    {/* ...devamı... */}
      <main className="flex-1 w-full max-w-7xl mx-auto py-8 px-4">
        {currentPage === 'dashboard' && (
          <Dashboard
            customers={customers}
            transactions={transactions}
            workerExpenses={workerExpenses}
            factoryOverhead={factoryOverhead}
            pomaceRevenues={pomaceRevenues}
            tinPurchases={tinPurchases}
            plasticPurchases={plasticPurchases}
            onOpenNewTransactionModal={handleOpenNewTransactionModal}
            navigateToCustomerDetails={navigateTo}
          />
        )}
        {currentPage === 'records' && (
          <Records
            customers={customers}
            transactions={transactions}
            onOpenNewTransactionModal={handleOpenNewTransactionModal}
            onEditTransaction={setEditingTransaction}
            onDeleteTransaction={(id) => handleDeleteItem('transactions', id)}
            onDeleteCustomer={handleDeleteItem}
            navigateToCustomerDetails={navigateTo}
          />
        )}
        {currentPage === 'customers' && (
          <OurCustomers
            customers={customers}
            transactions={transactions}
            navigateToCustomerDetails={navigateTo}
            onOpenNewTransactionModal={handleOpenNewTransactionModal}
            onCollectPayment={handleCollectPayment}
            onDeleteSelected={handleDeleteSelectedCustomers}
          />
        )}
        {currentPage === 'oilTrading' && ( // Yeni sayfa render edildi
          <OilTrading
            oilPurchases={oilPurchases}
            oilSales={oilSales}
            onSaveOilPurchase={handleSaveOilPurchase}
            onSaveOilSale={handleSaveOilSale}
            onDeleteItem={handleDeleteItem}
            defaultPrices={defaultPrices}
          />
        )}
        {currentPage === 'statistics' && (
          <Statistics
            transactions={transactions}
            tinPurchases={tinPurchases}
            plasticPurchases={plasticPurchases}
          />
        )}
        {currentPage === 'stock' && (
          <StockPage
            tinPurchases={tinPurchases}
            plasticPurchases={plasticPurchases}
            transactions={transactions}
          />
        )}
        {currentPage === 'expenses' && (
          <FactoryExpenses 
            workerExpenses={workerExpenses} 
            factoryOverhead={factoryOverhead} 
            pomaceRevenues={pomaceRevenues} 
            tinPurchases={tinPurchases} 
            plasticPurchases={plasticPurchases}
            onSaveWorkerExpense={handleSaveWorkerExpense}
            onSaveFactoryOverhead={handleSaveFactoryOverhead}
            onSavePomaceRevenue={handleSavePomaceRevenue}
            onSaveTinPurchase={handleSaveTinPurchase}
            onSavePlasticPurchase={handleSavePlasticPurchase}
            onDeleteItem={(collectionName, id) => handleDeleteItem(collectionName, id)}
          />
        )}
        {currentPage === 'factory-expenses' && (
          <FactoryExpenses
            workerExpenses={workerExpenses}
            factoryOverhead={factoryOverhead}
            pomaceRevenues={pomaceRevenues}
            tinPurchases={tinPurchases}
            plasticPurchases={plasticPurchases}
            onSaveWorkerExpense={handleSaveWorkerExpense}
            onDeleteWorkerExpense={handleDeleteItem}
            onSaveFactoryOverhead={handleSaveFactoryOverhead}
            onDeleteFactoryOverhead={handleDeleteItem}
            onSavePomaceRevenue={handleSavePomaceRevenue}
            onDeletePomaceRevenue={handleDeleteItem}
            onSaveTinPurchase={handleSaveTinPurchase}
            onDeleteTinPurchase={handleDeleteItem}
            onSavePlasticPurchase={handleSavePlasticPurchase}
            onDeletePlasticPurchase={handleDeleteItem}
          />
        )}
        {currentPage === 'customerDetails' && (
          <CustomerDetails 
            customer={selectedCustomer} 
            transactions={transactions.filter(t => t.customerId === selectedCustomer.id)}
            onBack={() => navigateTo('records')} 
            onEditTransaction={handleOpenNewTransactionModal}
            onDeleteTransaction={(id) => handleDeleteItem('transactions', id)}
            onDeleteCustomer={handleDeleteSingleCustomer}
          />
        )}
        {currentPage === 'backup' && (
          <BackupPage
            customers={customers}
            transactions={transactions}
            workerExpenses={workerExpenses}
            factoryOverhead={factoryOverhead}
            pomaceRevenues={pomaceRevenues}
            tinPurchases={tinPurchases}
            plasticPurchases={plasticPurchases}
            oilPurchases={oilPurchases}
            oilSales={oilSales}
          />
        )}
      </main>
      {/* MODALLAR */}
      {showNewTransactionModal && (
        <NewTransactionModal
          onClose={handleCloseNewTransactionModal}
          onSave={handleSaveTransaction}
          customers={customers}
          editingTransaction={editingTransaction}
          defaultPrices={defaultPrices}
          onSaveDefaultPrices={handleSaveDefaultPrices}
        />
      )}
      {showConfirmationModal && (
        <ConfirmationModal
          message={confirmationAction?.message}
          onConfirm={confirmDelete}
          onCancel={() => setShowConfirmationModal(false)}
          isLoading={isDeleting}
        />
      )}
      {/* Diğer modallar buraya eklenebilir */}
    </div>
  );
}

const FormField = ({ label, id, ...props }) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
      {label}
    </label>
    <input
      id={id}
      {...props}
      className="block w-full border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-emerald-500 focus:border-emerald-500"
    />
  </div>
);

const TextAreaField = ({ label, id, ...props }) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
      {label}
    </label>
    <textarea
      id={id}
      {...props}
      className="block w-full border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-emerald-500 focus:border-emerald-500"
    />
  </div>
);

const NavItem = ({ icon, text, active, onClick, textClassName = '' }) => (
  <button
    onClick={onClick}
    className={`flex items-center justify-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${active ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
  >
    <span className="w-6 h-6">{icon}</span>
    <span className={`font-semibold text-base ${textClassName}`}>
      {text}
    </span>
  </button>
);

const Dashboard = ({ customers, transactions, workerExpenses, factoryOverhead, pomaceRevenues, tinPurchases, plasticPurchases, onOpenNewTransactionModal, navigateToCustomerDetails }) => {
  const [transactionLimit, setTransactionLimit] = useState(5);

  const totalOlive = transactions.reduce((sum, t) => sum + Number(t.oliveKg || 0), 0);
  const totalProducedOil = transactions.reduce((sum, t) => sum + Number(t.oilLitre || 0), 0);
  const totalReceivedPayment = transactions.reduce((sum, t) => sum + Number(t.paymentReceived || 0), 0);
  const totalBilledAmount = transactions.reduce((sum, t) => sum + Number(t.totalCost || 0), 0);
  const totalPaymentLoss = transactions.reduce((sum, t) => sum + Number(t.paymentLoss || 0), 0);
  const pendingPayments = totalBilledAmount - totalReceivedPayment - totalPaymentLoss;

  const totalFactoryWorkerExpenses = workerExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const totalFactoryOverheadExpenses = factoryOverhead.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const totalFactoryPomaceRevenues = pomaceRevenues.reduce((sum, revenue) => sum + Number(revenue.totalRevenue || 0), 0);
  
  const totalFactoryIncome = totalBilledAmount + totalFactoryPomaceRevenues - totalPaymentLoss;
  const totalFactoryExpenses = totalFactoryWorkerExpenses + totalFactoryOverheadExpenses;
  const netFactoryBalance = totalFactoryIncome - totalFactoryExpenses;

  // Hasılat kalemlerini hesapla
  const oliveIncome = transactions.reduce((sum, t) => sum + (Number(t.oliveKg || 0) * Number(t.pricePerKg || 0)), 0);
  const tinIncome = transactions.reduce((sum, t) => sum +
    (Number(t.tinCounts?.s16 || 0) * Number(t.tinPrices?.s16 || 0)) +
    (Number(t.tinCounts?.s10 || 0) * Number(t.tinPrices?.s10 || 0)) +
    (Number(t.tinCounts?.s5 || 0) * Number(t.tinPrices?.s5 || 0)), 0);

  const plasticIncome = transactions.reduce((sum, t) => sum +
    (Number(t.plasticCounts?.s10 || 0) * Number(t.plasticPrices?.s10 || 0)) +
    (Number(t.plasticCounts?.s5 || 0) * Number(t.plasticPrices?.s5 || 0)) +
    (Number(t.plasticCounts?.s2 || 0) * Number(t.plasticPrices?.s2 || 0)), 0);

  // Yeni: Zeytin Çekim Ücreti (sadece zeytin miktarı * kg başına ücret)
  const totalOlivePressingFee = transactions.reduce((sum, t) => {
    const oliveFee = (Number(t.oliveKg) || 0) * (Number(t.pricePerKg) || 0);
    return sum + oliveFee;
  }, 0);

  // Genel zeytin/yağ oranını hesapla
  const totalOliveAll = transactions.reduce((sum, t) => sum + Number(t.oliveKg || 0), 0);
  const totalOilAll = transactions.reduce((sum, t) => sum + Number(t.oilLitre || 0), 0);
  const overallAvgRatio = totalOliveAll > 0 && totalOilAll > 0 
    ? (totalOliveAll / totalOilAll).toFixed(2) 
    : 'N/A';

  const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  const latestTransactions = transactionLimit === 'all' ? sortedTransactions : sortedTransactions.slice(0, Number(transactionLimit));
  
  const getCustomerName = (customerId) => customers.find(c => c.id === customerId)?.name || 'Bilinmeyen Müşteri';

  // Menü kartları için yardımcı fonksiyon
  const menuCards = [
    { icon: <Home className="w-6 h-6" />, text: 'Ana Sayfa', page: 'dashboard' },
    { icon: <List className="w-6 h-6" />, text: 'Kayıtlar', page: 'records' },
    { icon: <Users className="w-6 h-6" />, text: 'Müşteriler', page: 'customers' },
    { icon: <BarChart2 className="w-6 h-6" />, text: 'İstatistikler', page: 'statistics' },
    { icon: <Package className="w-6 h-6" />, text: 'Stok', page: 'stock' },
    { icon: <DollarSign className="w-6 h-6" />, text: 'Giderler', page: 'factory-expenses' },
    { icon: <Download className="w-6 h-6" />, text: 'Yedekler', page: 'backup' },
  ];
  // setCurrentPage fonksiyonu App'ten props ile gelmeli, burada window.dispatchEvent ile tetiklenebilir veya context ile yapılabilir. Şimdilik örnek olarak bırakıyorum.

  const factorySummary = calculateFactorySummary({
    transactions,
    workerExpenses,
    factoryOverhead,
    pomaceRevenues,
    tinPurchases,
    plasticPurchases
  });

  return (
    <div className="flex flex-col gap-8">
      {/* Ana Ekran başlığı ve Müşteri Ekle butonu */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Ana Ekran</h1>
        <button 
          onClick={() => onOpenNewTransactionModal(null)} 
          className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-md transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>İşlem Ekle</span>
        </button>
      </div>


      {/* Finansal özet kartları */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-2">
        {/* Üst Sıra - Üretim ve Oranlar */}
        <SummaryCard title="Toplam İşlenen Zeytin" value={formatNumber(totalOlive, 'kg')} icon={<Leaf className="text-[#556B2F] text-xl" />} />
        <SummaryCard title="Toplam Çıkan Yağ" value={formatNumber(totalProducedOil, 'L')} icon={<Droplet className="text-[#556B2F] text-xl" />} />
        <SummaryCard title="Genel Zeytin/Yağ Oranı" value={overallAvgRatio} icon={<Percent className="text-purple-600" />} />
        <SummaryCard title="Zeytin Çekim Ücreti" value={formatNumber(totalOlivePressingFee, '₺')} icon={<Coins className="text-emerald-600" />} />
        {/* Alt Sıra - Finansal Metrikler (YENİ SIRALAMA) */}
        <SummaryCard
          title="Toplam Hasılat"
          value={formatNumber(totalBilledAmount - totalPaymentLoss, '₺')}
          icon={<DollarSign className="w-6 h-6 text-emerald-600" />}
          iconColorClass="text-blue-600"
        >
          <div className="text-sm text-gray-600" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '5px' }}>
            <div><span className="font-semibold">Zeytin Sıkımı:</span> {formatNumber(oliveIncome, '₺')}</div>
            <div><span className="font-semibold">Teneke Satışı:</span> {formatNumber(tinIncome, '₺')}</div>
            <div><span className="font-semibold">Bidon Satışı:</span> {formatNumber(plasticIncome, '₺')}</div>
          </div>
        </SummaryCard>
        <SummaryCard title="Alınan Ödeme" value={formatNumber(totalReceivedPayment, '₺')} icon={<DollarSign className="text-[#556B2F] text-xl" />} iconColorClass="text-green-600" />
        <SummaryCard title="Bekleyen Ödemeler" value={formatNumber(pendingPayments, '₺')} icon={<AlertCircle className="text-[#556B2F] text-xl" />} iconColorClass="text-red-600" />
        <SummaryCard title="Ödeme Firesi" value={formatNumber(totalPaymentLoss, '₺')} icon={<Coins className="text-orange-600" />} />
      </div>
      {/* Fabrika Toplam Gelir Gider Özeti bölümü */}
      <div className="mt-8">
        <FactoryFinancialSummaryCard summary={factorySummary} />
      </div>

      {/* Son işlemler başlığı ve seçim aracı */}
      <div className="flex items-center justify-between mt-8 mb-2">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Son İşlemler</h2>
        <select value={transactionLimit} onChange={e => setTransactionLimit(e.target.value)} className="border rounded px-2 py-1">
          <option value={5}>Son 5</option>
          <option value={10}>Son 10</option>
          <option value={20}>Son 20</option>
          <option value="all">Tümü</option>
        </select>
      </div>

      {/* Son işlemler tablosu */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white rounded-lg shadow divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tarih</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Müşteri</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Açıklama</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tutar</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Alınan</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Bakiye</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {latestTransactions.map(t => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(t.date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {/* Müşteri isminin stili güncellendi */}
                  <button 
                    onClick={() => navigateToCustomerDetails('customerDetails', { id: t.customerId, name: getCustomerName(t.customerId) })} 
                    className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold transition-colors hover:bg-blue-200"
                  >
                    {getCustomerName(t.customerId)}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {t.description ? `${t.description} (${formatNumber(t.oliveKg)} kg zeytin)` : `${formatNumber(t.oliveKg)} kg zeytin`}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatNumber(t.totalCost, '₺')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-emerald-600">
                  {formatNumber(t.paymentReceived, '₺')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                  {formatNumber((t.totalCost || 0) - (t.paymentReceived || 0) - (t.paymentLoss || 0), '₺')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {/* Düzenle butonunun stili güncellendi */}
                  <button 
                    onClick={() => onOpenNewTransactionModal(t)} 
                    className="p-2 bg-gray-200 text-gray-600 rounded-full hover:bg-gray-300 hover:text-gray-800 transition-colors"
                    title="İşlemi Düzenle"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const FactoryFinancialSummaryCard = ({ summary }) => {
  // KORUMA KALKANI: Eğer özet verisi henüz gelmediyse, çökme, bekle.
  if (!summary) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md col-span-full text-center text-gray-500">
        Finansal özet hesaplanıyor...
      </div>
    );
  }
  const { 
    totalFactoryIncome, 
    totalFactoryExpenses, 
    netFactoryBalance, 
    totalWorkerExpenses, 
    totalFactoryOverhead, 
    totalPomaceRevenues, 
    totalBilledAmount, 
    totalPaymentLoss, 
    toplamTenekeKalanMaliyet, 
    toplamBidonKalanMaliyet,
    totalTinPurchaseCost,
    totalPlasticPurchaseCost
  } = summary;
  return (
    <div className="bg-white p-6 rounded-lg shadow-md col-span-full">
      <h2 className="text-xl font-semibold text-gray-800 mb-4" style={{ fontSize: '26px', textAlign: 'center' }}>Fabrika Toplam Gelir Gider Özeti</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-emerald-50 p-4 rounded-lg flex flex-col items-center justify-center">
          <DollarSign className="w-8 h-8 text-emerald-600 mb-2" />
          <p className="text-lg font-medium text-gray-700" style={{ fontSize: '22px', color: '#212121' }}>Toplam Gelir</p>
          <p className="text-2xl font-bold text-emerald-800">{formatNumber(totalFactoryIncome, '₺')}</p>
          <div className="text-sm text-gray-600 mt-2 text-center">
            <p>Toplam Hasılat: {formatNumber(totalBilledAmount, '₺')}</p>
            <p>Pirina Geliri: {formatNumber(totalPomaceRevenues, '₺')}</p>
            <p>Ödeme Firesi: -{formatNumber(totalPaymentLoss, '₺')}</p>
            <p>Kalan Teneke Stok Değeri: {formatNumber(toplamTenekeKalanMaliyet, '₺')}</p>
            <p>Kalan Bidon Stok Değeri: {formatNumber(toplamBidonKalanMaliyet, '₺')}</p>
          </div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg flex flex-col items-center justify-center">
          <Info className="w-8 h-8 text-red-600 mb-2" />
          <p className="text-lg font-medium text-gray-700" style={{ fontSize: '22px', color: '#212121' }}>Toplam Gider</p>
          <p className="text-2xl font-bold text-red-800">{formatNumber(totalFactoryExpenses, '₺')}</p>
          <div className="text-sm text-gray-600 mt-2">
            <p>İşçi Giderleri: {formatNumber(totalWorkerExpenses, '₺')}</p>
            <p>Muhtelif Giderler: {formatNumber(totalFactoryOverhead, '₺')}</p>
            <p>Teneke Alımları: {formatNumber(totalTinPurchaseCost, '₺')}</p>
            <p>Bidon Alımları: {formatNumber(totalPlasticPurchaseCost, '₺')}</p>
          </div>
        </div>
        <div className={`p-4 rounded-lg flex flex-col items-center justify-center ${netFactoryBalance >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}> 
          <BarChart2 className={`w-8 h-8 mb-2 ${netFactoryBalance >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
          <p className="text-lg font-medium text-gray-700" style={{ fontSize: '22px', color: '#212121' }}>Net Kar-Zarar</p>
          <p className={`text-2xl font-bold ${netFactoryBalance >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>{formatNumber(netFactoryBalance, '₺')}</p>
        </div>
      </div>
    </div>
  );
};

const OurCustomers = ({ customers, transactions, navigateToCustomerDetails, onOpenNewTransactionModal, onCollectPayment, onDeleteSelected }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [balanceFilter, setBalanceFilter] = useState('all'); // 'all', 'debtors', 'non-debtors'
  const [paymentModalState, setPaymentModalState] = useState({ isOpen: false, customer: null });
  const [selectedCustomers, setSelectedCustomers] = useState([]);

  const customerSummaries = customers.map(customer => {
      const customerTransactions = transactions.filter(t => t.customerId === customer.id);
      const totalBilled = customerTransactions.reduce((sum, t) => sum + Number(t.totalCost || 0), 0);
      const totalPaid = customerTransactions.reduce((sum, t) => sum + Number(t.paymentReceived || 0), 0);
      const totalLoss = customerTransactions.reduce((sum, t) => sum + Number(t.paymentLoss || 0), 0);
      return { ...customer, remainingBalance: totalBilled - totalPaid - totalLoss };
  });

  const sortedCustomers = customerSummaries.sort((a, b) => a.name.localeCompare(b.name, 'tr', { sensitivity: 'base' }));
  
  const filteredCustomers = sortedCustomers
    .filter(customer => customer.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter(customer => {
      if (balanceFilter === 'debtors') {
        return customer.remainingBalance > 0;
      }
      if (balanceFilter === 'non-debtors') {
        return customer.remainingBalance <= 0;
      }
      return true; // 'all' durumu için tüm müşterileri göster
    });

  // Toplu seçim fonksiyonları
  const allVisibleCustomerIds = filteredCustomers.map(c => c.id);
  const isAllSelected = allVisibleCustomerIds.length > 0 && allVisibleCustomerIds.every(id => selectedCustomers.includes(id));
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedCustomers(allVisibleCustomerIds);
    } else {
      setSelectedCustomers([]);
    }
  };
  const handleSelectCustomer = (id) => {
    setSelectedCustomers(prev => prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]);
  };

  const handleSavePayment = (customerId, customerName, amount) => {
    onCollectPayment(customerId, customerName, amount);
    setPaymentModalState({ isOpen: false, customer: null });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-gray-800">Müşterilerimiz</h1>
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Müşteri Ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 w-full"
            />
          </div>
          <div className="flex space-x-2">
            <button 
              onClick={() => setBalanceFilter('all')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${balanceFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              Tümü
            </button>
            <button 
              onClick={() => setBalanceFilter('debtors')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${balanceFilter === 'debtors' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              Borçlu Olanlar
            </button>
            <button 
              onClick={() => setBalanceFilter('non-debtors')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${balanceFilter === 'non-debtors' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              Borcu Olmayanlar
            </button>
            {selectedCustomers.length > 0 && (
              <button 
                onClick={() => onDeleteSelected(selectedCustomers)} 
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Seçilen ({selectedCustomers.length}) Müşteriyi Sil
              </button>
            )}
          </div>
        </div>
      </div>

      {filteredCustomers.length === 0 ? (
        <div className="bg-white p-6 rounded-lg shadow-md text-center text-gray-500">
          <p>Aramanızla eşleşen müşteri bulunamadı.</p>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Tüm Müşteriler</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 customer-table-header">
                <tr>
                  <th className="px-2 py-3 text-center">
                    <input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Müşteri Adı</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kalan Bakiye</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İşlemler</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCustomers.map(customer => (
                  <tr key={customer.id}>
                    <td className="px-2 py-4 text-center">
                      <input type="checkbox" checked={selectedCustomers.includes(customer.id)} onChange={() => handleSelectCustomer(customer.id)} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <button onClick={() => navigateToCustomerDetails('customerDetails', customer)} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold transition-colors hover:bg-blue-200">{customer.name}</button>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${customer.remainingBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {formatNumber(customer.remainingBalance, '₺')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => setPaymentModalState({ isOpen: true, customer: customer })} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm mr-2" title="Tahsilat Yap">Tahsilat Yap</button>
                      <button onClick={() => onOpenNewTransactionModal({ customerId: customer.id, customerName: customer.name })} className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm mr-2" title="İşlem Ekle">İşlem Ekle</button>
                      {/* EKSİK OLAN BİLGİ BUTONU EKLENDİ */}
                      <button onClick={() => navigateToCustomerDetails('customerDetails', customer)} className="p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 hover:text-gray-800 transition-colors" title="Müşteri Detaylarını Görüntüle">
                        <Info className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {paymentModalState.isOpen && (
        <PaymentCollectionModal 
          customer={paymentModalState.customer}
          onClose={() => setPaymentModalState({ isOpen: false, customer: null })}
          onSavePayment={handleSavePayment}
        />
      )}
    </div>
  );
};

const Records = ({ customers, transactions, onOpenNewTransactionModal, onEditTransaction, onDeleteTransaction, onDeleteCustomer, navigateToCustomerDetails }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedCustomerId, setExpandedCustomerId] = useState(null);

  const customerSummary = customers.map(customer => {
    const customerTransactions = transactions.filter(t => t.customerId === customer.id);
    const totalCustomerBilled = customerTransactions.reduce((sum, t) => sum + Number(t.totalCost || 0), 0);
    const totalCustomerPaid = customerTransactions.reduce((sum, t) => sum + Number(t.paymentReceived || 0), 0);
    const totalCustomerLoss = customerTransactions.reduce((sum, t) => sum + Number(t.paymentLoss || 0), 0);
    const totalCustomerOlive = customerTransactions.reduce((sum, t) => sum + Number(t.oliveKg || 0), 0);
    return { ...customer, totalBilled: totalCustomerBilled, totalPaid: totalCustomerPaid, totalOlive: totalCustomerOlive, remainingBalance: totalCustomerBilled - totalCustomerPaid - totalCustomerLoss, transactions: customerTransactions.sort((a, b) => new Date(b.date) - new Date(a.date)) };
  });

  const filteredCustomers = customerSummary.filter(customer => {
    const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase());
    const customerHasTransactionsInDateRange = customer.transactions.some(t => {
      const transactionDate = new Date(t.date);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      return (!start || transactionDate >= start) && (!end || transactionDate <= end);
    });
    return matchesSearch && (customer.transactions.length === 0 || customerHasTransactionsInDateRange);
  });

  const handleExport = () => {
    const headers = ["Müşteri Adı", "İşlem Tarihi", "Zeytin (kg)", "Yağ (L)", "Yağ Oranı", "Kg Başına Ücret (₺)", "Teneke Kap Sayısı", "Teneke Kap Fiyatı (₺)", "Plastik Kap Sayısı", "Plastik Kap Fiyatı (₺)", "Toplam Ücret (₺)", "Alınan Ödeme (₺)", "Kalan Bakiye (₺)"];
    let csvContent = headers.join(";") + "\n";
    filteredCustomers.forEach(customer => {
      customer.transactions.forEach(t => {
        const row = [`"${customer.name}"`, new Date(t.date).toLocaleDateString(), t.oliveKg || 0, t.oilLitre || 0, formatOilRatioDisplay(t.oliveKg, t.oilLitre), t.pricePerKg || 0, t.tinCount || 0, t.tinPrice || 0, t.plasticCount || 0, t.plasticPrice || 0, t.totalCost || 0, t.paymentReceived || 0, (t.totalCost || 0) - (t.paymentReceived || 0)];
        csvContent += row.join(";") + "\n";
      });
    });
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `zeytinyagi_kayitlar_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Kayıtlar</h1>
      <div className="bg-white p-6 rounded-lg shadow-md flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 md:space-x-4">
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 w-full md:w-auto">
          <div className="relative w-full sm:w-auto"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" /><input type="text" placeholder="Müşteri Ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 border rounded-lg w-full" /></div>
          <div className="relative w-full sm:w-auto"><Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" /><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="pl-10 pr-4 py-2 border rounded-lg w-full" /></div>
          <div className="relative w-full sm:w-auto"><Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" /><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="pl-10 pr-4 py-2 border rounded-lg w-full" /></div>
        </div>
        <div className="flex space-x-2 w-full md:w-auto justify-end">
          <button onClick={handleExport} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md"><Download className="w-5 h-5" /><span>Dışa Aktar</span></button>
          <button onClick={() => onOpenNewTransactionModal(null)} className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-md"><Plus className="w-5 h-5" /><span>İşlem Ekle</span></button>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Müşteri Kayıtları</h2>
        {filteredCustomers.length === 0 ? <p className="text-gray-500">Filtrelerinize uygun müşteri bulunamadı.</p> : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Müşteri Adı</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Toplam Zeytin (kg)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Toplam Ücret</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Alınan Ödeme</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kalan Bakiye</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">İşlemler</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCustomers.map(customer => (
                  <React.Fragment key={customer.id}>
                    <tr className="hover:bg-gray-50 customer-table-row">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {/* MÜŞTERİ İSMİ TIKLANABİLİR HALE GETİRİLDİ */}
                        <button 
                          onClick={() => navigateToCustomerDetails('customerDetails', customer)} 
                          className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold transition-colors hover:bg-blue-200"
                        >
                          {customer.name}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm customer-table-cell">{formatNumber(customer.totalOlive)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm customer-table-cell">{formatNumber(customer.totalBilled, '₺')}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm customer-table-cell payment-green`}>{formatNumber(customer.totalPaid, '₺')}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm customer-table-cell balance-red`}>{formatNumber(customer.remainingBalance, '₺')}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm customer-table-cell">
                        <button onClick={() => setExpandedCustomerId(expandedCustomerId === customer.id ? null : customer.id)} className="see-transactions-btn text-blue-900">{expandedCustomerId === customer.id ? 'Daralt' : 'İşlemleri Gör'} ({customer.transactions.length})</button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium customer-table-cell">
                        <button onClick={() => onOpenNewTransactionModal({ customerId: customer.id, customerName: customer.name })} className="px-2 py-1 text-xs bg-emerald-600 text-white rounded-md hover:bg-emerald-700 shadow-sm mr-2">İşlem Ekle</button>
                        <button onClick={() => navigateToCustomerDetails('customerDetails', customer)} className="p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 hover:text-gray-800 transition-colors"><Edit className="w-5 h-5" /></button>
                      </td>
                    </tr>
                    {expandedCustomerId === customer.id && customer.transactions.length > 0 && (
                      <tr className="bg-gray-50">
                        <td colSpan="7" className="p-0">
                          <div className="px-6 py-4">
                            <h4 className="text-md font-semibold text-gray-700 mb-2">İşlem Detayları:</h4>
                            <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 border rounded-lg">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Tarih</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Açıklama</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Ücret</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Alınan Ödeme</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Bakiye</th><th className="px-4 py-2"></th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-100">
                                {customer.transactions.map(t => {
                                  const remainingBalance = (t.totalCost || 0) - (t.paymentReceived || 0) - (t.paymentLoss || 0);
                                  const description = t.description ? `${t.description} (${formatNumber(t.oliveKg)} kg zeytin)` : `${formatNumber(t.oliveKg)} kg zeytin`;
                                  return (
                                    <tr key={t.id}>
                                      <td className="px-4 py-2 whitespace-nowrap text-sm">{new Date(t.date).toLocaleDateString()}</td>
                                      <td className="px-4 py-2 whitespace-nowrap text-sm">{description}</td>
                                      <td className="px-4 py-2 whitespace-nowrap text-sm">{formatNumber(t.totalCost, '₺')}</td>
                                      <td className="px-4 py-2 whitespace-nowrap text-sm">{formatNumber(t.paymentReceived, '₺')}</td>
                                      <td className={`px-4 py-2 whitespace-nowrap text-sm ${remainingBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatNumber(remainingBalance, '₺')}</td>
                                      <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium">
                                        <button onClick={() => onEditTransaction(t)} className="p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 hover:text-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={t.description === 'Ara Tahsilat'}><Edit className="w-4 h-4" /></button>
                                        <button 
                                          onClick={() => onDeleteTransaction(t.id)} 
                                          className="text-red-600 p-1 rounded-full hover:bg-red-50 ml-1"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table></div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const CustomerDetails = ({ customer, transactions, onEditTransaction, onDeleteTransaction, onBack, onDeleteCustomer }) => {
  const printRef = useRef();
  const handlePrint = () => {
    const printContent = printRef.current;
    if (printContent) {
      const printWindow = window.open('', '_blank');
      printWindow.document.write('<html><head><title>Müşteri Detayları</title>');
      printWindow.document.write(`
        <style>
          @media print { @page { size: A5; margin: 10mm; } }
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
          .print-header { text-align: center; font-size: 1.6rem; font-weight: bold; margin-bottom: 8px; letter-spacing: 1px; }
          .print-section { margin-bottom: 8px; }
          .print-table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
          .print-table th, .print-table td { border: 1px solid #bbb; padding: 4px 6px; text-align: left; }
          .print-table th { background: #f3f3f3; }
          .print-summary { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
          .print-summary-item { flex: 1 1 40%; min-width: 120px; margin-bottom: 2px; }
          .print-label { font-weight: bold; }
          .print-value { margin-left: 4px; }
          .print-border { border:2px dashed #333; border-radius:12px; padding:18px; max-width:650px; margin:0 auto; }
        </style>
      `);
      printWindow.document.write('</head><body>');
      printWindow.document.write('<div class="print-border">');
      printWindow.document.write('<div class="print-header">DÜLDÜL ZEYTİNYAĞI FABRİKASI</div>');
      // MÜŞTERİ BİLGİLERİ
      printWindow.document.write('<div class="print-section print-summary">');
      printWindow.document.write(`<div class="print-summary-item"><span class="print-label">Müşteri:</span><span class="print-value">${customer.name}</span></div>`);
      printWindow.document.write(`<div class="print-summary-item"><span class="print-label">Toplam İşlem:</span><span class="print-value">${transactions.length}</span></div>`);
      printWindow.document.write(`<div class="print-summary-item"><span class="print-label">İşlenen Zeytin:</span><span class="print-value">${formatNumber(totalOliveProcessed, 'kg')}</span></div>`);
      printWindow.document.write(`<div class="print-summary-item"><span class="print-label">Üretilen Yağ:</span><span class="print-value">${formatNumber(totalOilProduced, 'L')}</span></div>`);
      printWindow.document.write(`<div class="print-summary-item"><span class="print-label">Yağ Oranı:</span><span class="print-value">${(totalOliveProcessed > 0 && totalOilProduced > 0) ? (totalOliveProcessed / totalOilProduced).toFixed(2) : '-'}</span></div>`);
      printWindow.document.write(`<div class="print-summary-item"><span class="print-label">Toplam Ücret:</span><span class="print-value">${formatNumber(totalBilledAmount, '₺')}</span></div>`);
      printWindow.document.write(`<div class="print-summary-item"><span class="print-label">Alınan Ödeme:</span><span class="print-value">${formatNumber(totalPaymentReceived, '₺')}</span></div>`);
      printWindow.document.write(`<div class="print-summary-item"><span class="print-label">Kalan Bakiye:</span><span class="print-value">${formatNumber(remainingBalance, '₺')}</span></div>`);
      printWindow.document.write(`<div class="print-summary-item"><span class="print-label">Kullanılan Kaplar:</span><span class="print-value">Teneke: ${totalTinCount}, Bidon: ${totalPlasticCount}</span></div>`);
      printWindow.document.write('</div>');
      // İŞLEM GEÇMİŞİ TABLOSU
      printWindow.document.write('<div class="print-section"><div class="print-label" style="margin-bottom:4px;">İşlem Geçmişi</div>');
      printWindow.document.write('<table class="print-table"><thead><tr><th>Tarih</th><th>Açıklama</th><th>Ücret</th><th>Alınan</th><th>Bakiye</th></tr></thead><tbody>');
      transactions.forEach(t => {
        const bakiye = (t.totalCost || 0) - (t.paymentReceived || 0) - (t.paymentLoss || 0);
        const description = t.description ? `${t.description} (${formatNumber(t.oliveKg)} kg zeytin)` : `${formatNumber(t.oliveKg)} kg zeytin`;
        printWindow.document.write(`<tr><td>${new Date(t.date).toLocaleDateString()}</td><td>${description}</td><td>${formatNumber(t.totalCost, '₺')}</td><td>${formatNumber(t.paymentReceived, '₺')}</td><td>${formatNumber(bakiye, '₺')}</td></tr>`);
      });
      printWindow.document.write('</tbody></table></div>');
      printWindow.document.write('</div>'); // border sonu
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 300);
    }
  };
  if (!customer) return <div className="text-center py-8"><p className="text-gray-600">Müşteri seçilmedi.</p><button onClick={onBack} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Geri Dön</button></div>;

  const totalOliveProcessed = transactions.reduce((sum, t) => sum + Number(t.oliveKg || 0), 0);
  const totalOilProduced = transactions.reduce((sum, t) => sum + Number(t.oilLitre || 0), 0);
  const totalBilledAmount = transactions.reduce((sum, t) => sum + Number(t.totalCost || 0), 0);
  const totalPaymentReceived = transactions.reduce((sum, t) => sum + Number(t.paymentReceived || 0), 0);
  const totalPaymentLoss = transactions.reduce((sum, t) => sum + Number(t.paymentLoss || 0), 0);
  const remainingBalance = totalBilledAmount - totalPaymentReceived - totalPaymentLoss;
  const totalTinCount = transactions.reduce((sum, t) => sum + (Number(t.tinCounts?.s16) || 0) + (Number(t.tinCounts?.s10) || 0) + (Number(t.tinCounts?.s5) || 0), 0);
  const totalPlasticCount = transactions.reduce((sum, t) => sum + (Number(t.plasticCounts?.s10) || 0) + (Number(t.plasticCounts?.s5) || 0) + (Number(t.plasticCounts?.s2) || 0), 0);
  const avgOilRatioDisplay = formatOilRatioDisplay(totalOliveProcessed, totalOilProduced);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Müşteri Detayları: {customer.name}</h1>
        <div className="flex gap-2">
          <button onClick={onBack} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 shadow-sm">Geri Dön</button>
          <button onClick={handlePrint} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 shadow-sm transition-colors">Yazdır</button>
          <button 
            onClick={() => onDeleteCustomer(customer.id, customer.name)} 
            className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 shadow-sm transition-colors"
          >
            <Trash2 className="inline-block w-5 h-5 mr-2" />
            Bu Müşteriyi Sil
          </button>
        </div>
      </div>
      <div ref={printRef}>
      <div className="bg-white p-6 rounded-lg shadow-md grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <SummaryCard title="Toplam İşlem Sayısı" value={transactions.length} icon={<List className="w-6 h-6 text-blue-600" />} />
        <SummaryCard title="İşlenen Zeytin" value={formatNumber(totalOliveProcessed, 'kg')} icon={<Info className="w-6 h-6 text-emerald-600" />} />
        <SummaryCard title="Üretilen Yağ" value={formatNumber(totalOilProduced, 'L')} icon={<Droplet className="w-6 h-6 text-blue-600" />} />
        <SummaryCard title="Ortalama Yağ Oranı" value={avgOilRatioDisplay} icon={<Percent className="w-6 h-6 text-purple-600" />} />
        <SummaryCard title="Toplam Ücret" value={formatNumber(totalBilledAmount, '₺')} icon={<DollarSign className="w-6 h-6 text-emerald-600" />} />
        <SummaryCard title="Kullanılan Kaplar" value={`Teneke: ${totalTinCount}, Bidon: ${totalPlasticCount}`} icon={<Package className="w-6 h-6 text-orange-600" />} />
        <SummaryCard title="Alınan Ödeme" value={formatNumber(totalPaymentReceived, '₺')} icon={<DollarSign className="w-6 h-6 text-blue-600" />} />
        <SummaryCard title="Ödeme Firesi" value={formatNumber(totalPaymentLoss, '₺')} icon={<Trash2 className="w-6 h-6 text-orange-600" />} />
        <SummaryCard title="Kalan Bakiye" value={formatNumber(remainingBalance, '₺')} icon={<Info className="w-6 h-6 text-red-600" />} />
      </div>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">İşlem Geçmişi</h2>
        {transactions.length === 0 ? <p className="text-gray-500">Bu müşteriye ait henüz bir işlem bulunmamaktadır.</p> : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarih</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Açıklama</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ücret</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Alınan Ödeme</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bakiye</th><th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map(t => {
                  const remainingBalance = (t.totalCost || 0) - (t.paymentReceived || 0) - (t.paymentLoss || 0);
                  const description = t.description ? `${t.description} (${formatNumber(t.oliveKg)} kg zeytin)` : `${formatNumber(t.oliveKg)} kg zeytin`;
                  return (
                    <tr key={t.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{new Date(t.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{description}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{formatNumber(t.totalCost, '₺')}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{formatNumber(t.paymentReceived, '₺')}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${remainingBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatNumber(remainingBalance, '₺')}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onClick={() => onEditTransaction(t)} className="p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 hover:text-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={t.description === 'Ara Tahsilat'}><Edit className="w-4 h-4" /></button>
                        <button 
                          onClick={() => onDeleteTransaction(t.id)} 
                          className="text-red-600 p-1 rounded-full hover:bg-red-50 ml-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

const Statistics = ({ transactions, tinPurchases, plasticPurchases }) => {
  const monthlyStatsMap = transactions.reduce((acc, t) => {
    const date = new Date(t.date);
    const monthYear = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    if (!acc[monthYear]) {
        acc[monthYear] = { totalOlive: 0, totalOil: 0, transactionCount: 0 };
    }
    acc[monthYear].totalOlive += Number(t.oliveKg || 0);
    acc[monthYear].totalOil += Number(t.oilLitre || 0);
    if (Number(t.oliveKg || 0) > 0) {
      acc[monthYear].transactionCount++;
    }
    return acc;
  }, {});

  const monthlyStats = Object.keys(monthlyStatsMap).map(monthYear => {
    const stats = monthlyStatsMap[monthYear];
    const avgRatio = stats.totalOlive > 0 && stats.totalOil > 0 ? (stats.totalOlive / stats.totalOil) : 0;
    return { monthYear, ...stats, avgRatio };
  }).sort((a, b) => new Date(a.monthYear) - new Date(b.monthYear));

  const totalTinRevenue = transactions.reduce((sum, t) =>
    sum + (Number(t.tinCounts?.s16 || 0) * Number(t.tinPrices?.s16 || 0)) +
          (Number(t.tinCounts?.s10 || 0) * Number(t.tinPrices?.s10 || 0)) +
          (Number(t.tinCounts?.s5 || 0) * Number(t.tinPrices?.s5 || 0)), 0);
  const totalTinPurchaseCost = tinPurchases.reduce((sum, p) => sum + Number(p.totalCost || 0), 0);
  const netTinProfit = totalTinRevenue - totalTinPurchaseCost;

  const totalPlasticRevenue = transactions.reduce((sum, t) => sum + (Number(t.plasticCounts?.s10 || 0) * Number(t.plasticPrices?.s10 || 0)) + (Number(t.plasticCounts?.s5 || 0) * Number(t.plasticPrices?.s5 || 0)) + (Number(t.plasticCounts?.s2 || 0) * Number(t.plasticPrices?.s2 || 0)), 0);
  const totalPlasticPurchaseCost = plasticPurchases.reduce((sum, p) => sum + Number(p.totalCost || 0), 0);
  const netPlasticProfit = totalPlasticRevenue - totalPlasticPurchaseCost;

  const totalOliveAll = transactions.reduce((sum, t) => sum + Number(t.oliveKg || 0), 0);
  const totalOilAll = transactions.reduce((sum, t) => sum + Number(t.oilLitre || 0), 0);
  const overallAvgRatio = totalOliveAll > 0 && totalOilAll > 0 ? (totalOliveAll / totalOilAll).toFixed(2) : 'N/A';

  // Adım 3: Detaylı Teneke Alım Analizi Kartı */}
  const detailedTinStats = calculateDetailedTinStatistics(tinPurchases);

  // Adım 4: Yeni kar/zarar fonksiyonunu kullan
  const tinProfitLoss = calculateTinProfitLoss(tinPurchases, transactions);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">İstatistikler</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center"><Package className="w-6 h-6 mr-2 text-orange-500" />Teneke Kar/Zarar Durumu</h2>
            <div className="space-y-2">
              <p className="flex justify-between"><span>Toplam Satış Geliri:</span> <span className="font-semibold">{formatNumber(totalTinRevenue, '₺')}</span></p>
              <p className="flex justify-between"><span>Toplam Alım Maliyeti:</span> <span className="font-semibold">{formatNumber(totalTinPurchaseCost, '₺')}</span></p>
              <p className={`flex justify-between border-t pt-2 mt-2 ${netTinProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}><span>Net Kar/Zarar:</span> <span className="font-bold">{formatNumber(netTinProfit, '₺')}</span></p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center"><Package className="w-6 h-6 mr-2 text-teal-500" />Bidon Kar/Zarar Durumu</h2>
            <div className="space-y-2">
              <p className="flex justify-between"><span>Toplam Satış Geliri:</span> <span className="font-semibold">{formatNumber(totalPlasticRevenue, '₺')}</span></p>
              <p className="flex justify-between"><span>Toplam Alım Maliyeti:</span> <span className="font-semibold">{formatNumber(totalPlasticPurchaseCost, '₺')}</span></p>
              <p className={`flex justify-between border-t pt-2 mt-2 ${netPlasticProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}><span>Net Kar/Zarar:</span> <span className="font-bold">{formatNumber(netPlasticProfit, '₺')}</span></p>
            </div>
          </div>
      </div>
      <SummaryCard title="Genel Zeytin/Yağ Oranı" value={overallAvgRatio} icon={<Percent className="w-6 h-6 text-purple-600" />} />
      {/* Adım 3: Detaylı Teneke Alım Analizi Kartı */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Detaylı Teneke Alım Analizi</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h3 className="text-lg font-bold text-blue-700 mb-2">16'lık Teneke Detayları</h3>
            <p>Toplam Alınan Adet: <span className="font-semibold">{formatNumber(detailedTinStats.s16.toplam_adet)}</span></p>
            <p>Toplam Ödenen Tutar: <span className="font-semibold">{formatNumber(detailedTinStats.s16.toplam_maliyet, '₺')}</span></p>
            <p>Ortalama Birim Fiyat: <span className="font-semibold">{formatNumber(detailedTinStats.s16.ortalama_birim_fiyat, '₺')}</span></p>
          </div>
          <div>
            <h3 className="text-lg font-bold text-blue-700 mb-2">10'luk Teneke Detayları</h3>
            <p>Toplam Alınan Adet: <span className="font-semibold">{formatNumber(detailedTinStats.s10.toplam_adet)}</span></p>
            <p>Toplam Ödenen Tutar: <span className="font-semibold">{formatNumber(detailedTinStats.s10.toplam_maliyet, '₺')}</span></p>
            <p>Ortalama Birim Fiyat: <span className="font-semibold">{formatNumber(detailedTinStats.s10.ortalama_birim_fiyat, '₺')}</span></p>
          </div>
          <div>
            <h3 className="text-lg font-bold text-blue-700 mb-2">5'lik Teneke Detayları</h3>
            <p>Toplam Alınan Adet: <span className="font-semibold">{formatNumber(detailedTinStats.s5.toplam_adet)}</span></p>
            <p>Toplam Ödenen Tutar: <span className="font-semibold">{formatNumber(detailedTinStats.s5.toplam_maliyet, '₺')}</span></p>
            <p>Ortalama Birim Fiyat: <span className="font-semibold">{formatNumber(detailedTinStats.s5.ortalama_birim_fiyat, '₺')}</span></p>
          </div>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Aylık İşlem Özeti</h2>
        {monthlyStats.length === 0 ? <p className="text-gray-500">Henüz aylık istatistik bulunmamaktadır.</p> : (
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ay/Yıl</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">İşlem Sayısı</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Toplam Zeytin (kg)</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Toplam Yağ (L)</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ort. Zeytin/Yağ Oranı</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {monthlyStats.map(stat => (
                            <tr key={stat.monthYear}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{stat.monthYear}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{stat.transactionCount}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{formatNumber(stat.totalOlive)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{formatNumber(stat.totalOil)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{stat.avgRatio.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
      </div>
    </div>
  );
};

// Yeni Zeytinyağı Alım/Satım Sayfası
const OilTrading = ({ oilPurchases, oilSales, onSaveOilPurchase, onSaveOilSale, onDeleteItem, defaultPrices }) => {
    const [showPurchaseModal, setShowPurchaseModal] = useState(false);
    const [editingPurchase, setEditingPurchase] = useState(null);
    const [showSaleModal, setShowSaleModal] = useState(false);
    const [editingSale, setEditingSale] = useState(null);

    // Kalan stok ve kar/zarar hesaplaması için state'ler
    const [netStock, setNetStock] = useState(0);
    const [netProfit, setNetProfit] = useState(0);
    const [totalPurchaseCost, setTotalPurchaseCost] = useState(0);
    const [totalSaleRevenue, setTotalSaleRevenue] = useState(0);
    const [manualStockPrice, setManualStockPrice] = useState(''); // Başlangıç değeri boş string yapıldı

    // useEffect hook'u ile her alım veya satım değiştiğinde hesaplamaları yap
    useEffect(() => {
      const totalPurchasedTins = oilPurchases.reduce((sum, p) => sum + Number(p.tinCount || 0), 0);
      const totalSoldTins = oilSales.reduce((sum, s) => sum + Number(s.tinCount || 0), 0);
      const totalPurchasesCostSum = oilPurchases.reduce((sum, p) => sum + Number(p.totalCost || 0), 0);
      const totalSalesRevenueSum = oilSales.reduce((sum, s) => sum + Number(s.totalRevenue || 0), 0);

      const calculatedNetStock = totalPurchasedTins - totalSoldTins;
      const stockValue = calculatedNetStock * Number(manualStockPrice || 0); // manualStockPrice boşsa 0 olarak kabul et
      const calculatedNetProfit = totalSalesRevenueSum - totalPurchasesCostSum + stockValue;

      setNetStock(calculatedNetStock);
      setNetProfit(calculatedNetProfit);
      setTotalPurchaseCost(totalPurchasesCostSum);
      setTotalSaleRevenue(totalSalesRevenueSum);

    }, [oilPurchases, oilSales, manualStockPrice]);

    const handleOpenPurchaseModal = (purchase = null) => {
        setEditingPurchase(purchase);
        setShowPurchaseModal(true);
    };

    const handleOpenSaleModal = (sale = null) => {
        setEditingSale(sale);
        setShowSaleModal(true);
    };

    const handleCloseModals = () => {
        setShowPurchaseModal(false);
        setEditingPurchase(null);
        setShowSaleModal(false);
        setEditingSale(null);
    };

    const sortedPurchases = [...oilPurchases].sort((a, b) => new Date(b.date) - new Date(a.date));
    const sortedSales = [...oilSales].sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-800">Zeytinyağı Alım/Satım</h1>

            {/* Özet Kartları */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <SummaryCard
                title="Toplam Alım Maliyeti"
                value={formatNumber(totalPurchaseCost, '₺')}
                icon={<DollarSign />}
                iconColorClass="text-red-600"
              />
              <SummaryCard
                title="Toplam Satış Geliri"
                value={formatNumber(totalSaleRevenue, '₺')}
                icon={<DollarSign />}
                iconColorClass="text-green-600"
              />
              <SummaryCard
                title="Kalan Net Teneke Stoğu"
                value={formatNumber(netStock, 'adet')}
                icon={<Package />}
                iconColorClass="text-blue-600"
              />
              <SummaryCard
                title="Net Kâr/Zarar"
                value={formatNumber(netProfit, '₺')}
                icon={<Coins />}
                iconColorClass={netProfit >= 0 ? 'text-green-600' : 'text-red-600'}
              />
            </div>
             {/* Manuel Stok Fiyatı Girişi */}
            <div className="bg-white p-6 rounded-lg shadow-md max-w-lg mx-auto">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Kalan Stok Değerlemesi</h3>
                <p className="text-sm text-gray-600 mb-4">Kalan teneke stoğunun adedini, gireceğiniz fiyatla çarparak net kâr/zarar hesabına otomatik olarak ekler.</p>
                <div className="flex items-center space-x-2">
                    <label htmlFor="manualStockPrice" className="text-sm font-medium text-gray-700">Teneke Birim Fiyatı (₺):</label>
                    <input
                        type="number"
                        id="manualStockPrice"
                        value={manualStockPrice}
                        onChange={(e) => setManualStockPrice(e.target.value)}
                        className="flex-1 p-2 border rounded-md shadow-sm"
                        placeholder="Örn: 250"
                    />
                </div>
            </div>

            {/* Satışlar */}
            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-gray-800">Satışlar</h2>
                    <button onClick={() => handleOpenSaleModal()} className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-md">
                        <Plus className="w-5 h-5" />
                        <span>Satış Ekle</span>
                    </button>
                </div>
                {oilSales.length === 0 ? <p className="text-gray-500">Henüz zeytinyağı satışı yapılmamıştır.</p> : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarih</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Müşteri</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teneke Sayısı</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teneke Fiyatı (₺)</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Satış Geliri (₺)</th>
                                    <th className="px-6 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {sortedSales.map(s => (
                                    <tr key={s.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">{new Date(s.date).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">{s.customerName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">{formatNumber(s.tinCount)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">{formatNumber(s.tinPrice, '₺')}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">{formatNumber(s.totalRevenue, '₺')}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button onClick={() => handleOpenSaleModal(s)} className="p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 hover:text-gray-800 transition-colors">
                                                <Edit className="w-5 h-5" />
                                            </button>
                                            <button onClick={() => onDeleteItem('oilSales', s.id)} className="ml-2 p-2 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Alımlar */}
            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-gray-800">Alımlar</h2>
                    <button onClick={() => handleOpenPurchaseModal()} className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-md">
                        <Plus className="w-5 h-5" />
                        <span>Alım Ekle</span>
                    </button>
                </div>
                {oilPurchases.length === 0 ? <p className="text-gray-500">Henüz zeytinyağı alımı yapılmamıştır.</p> : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarih</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Firma/Şahıs</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teneke Sayısı</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teneke Fiyatı (₺)</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Alım Maliyeti (₺)</th>
                                    <th className="px-6 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {sortedPurchases.map(p => (
                                    <tr key={p.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">{new Date(p.date).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">{p.supplierName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">{formatNumber(p.tinCount)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">{formatNumber(p.tinPrice, '₺')}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">{formatNumber(p.totalCost, '₺')}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button onClick={() => handleOpenPurchaseModal(p)} className="p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 hover:text-gray-800 transition-colors">
                                                <Edit className="w-5 h-5" />
                                            </button>
                                            <button onClick={() => onDeleteItem('oilPurchases', p.id)} className="ml-2 p-2 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showPurchaseModal && <OilPurchaseModal onClose={handleCloseModals} onSave={onSaveOilPurchase} editingPurchase={editingPurchase} />}
            {showSaleModal && <OilSaleModal onClose={handleCloseModals} onSave={onSaveOilSale} editingSale={editingSale} />}
        </div>
    );
};

const OilPurchaseModal = ({ onClose, onSave, editingPurchase }) => {
    const [formData, setFormData] = useState({ date: new Date(), supplierName: '', tinCount: '', tinPrice: '' });
    useEffect(() => { if (editingPurchase) { const d = new Date(editingPurchase.date); setFormData({ ...editingPurchase, date: !isNaN(d.getTime()) ? d : new Date() }); } }, [editingPurchase]);
    const handleChange = (e) => { const { name, value } = e.target; setFormData(p => ({ ...p, [name]: value })); };
    const totalCost = roundToTwo(Number(formData.tinCount) * Number(formData.tinPrice));
    const handleSubmit = (e) => { e.preventDefault(); onSave({ ...formData, totalCost, id: editingPurchase?.id }); onClose(); };
    return <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg shadow-xl w-full max-w-xl p-6"><h2 className="text-2xl font-bold mb-6">{editingPurchase ? 'Zeytinyağı Alımını Düzenle' : 'Yeni Zeytinyağı Alımı Ekle'}</h2><form onSubmit={handleSubmit} className="space-y-4"><FormField label="Tarih" id="date" type="date" name="date" value={toInputDateString(formData.date)} onChange={handleChange} required /><FormField label="Firma/Şahıs Adı" id="supplierName" type="text" name="supplierName" value={formData.supplierName} onChange={handleChange} required /><FormField label="Teneke Sayısı" id="tinCount" type="number" name="tinCount" value={formData.tinCount} onChange={handleChange} required /><FormField label="Teneke Fiyatı (₺)" id="tinPrice" type="number" name="tinPrice" value={formData.tinPrice} onChange={handleChange} required /><div className="bg-gray-50 p-3 rounded-md"><label>Hesaplanan Alım Maliyeti</label><p className="font-bold">{formatNumber(totalCost, '₺')}</p></div><div className="flex justify-end space-x-3 mt-6"><button type="button" onClick={onClose} className="px-6 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors shadow-sm">İptal</button><button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded">Kaydet</button></div></form></div></div>;
};

const OilSaleModal = ({ onClose, onSave, editingSale }) => {
    const [formData, setFormData] = useState({ date: new Date(), customerName: '', tinCount: '', tinPrice: '' });
    useEffect(() => { if (editingSale) { const d = new Date(editingSale.date); setFormData({ ...editingSale, date: !isNaN(d.getTime()) ? d : new Date() }); } }, [editingSale]);
    const handleChange = (e) => { const { name, value } = e.target; setFormData(p => ({ ...p, [name]: value })); };
    const totalRevenue = roundToTwo(Number(formData.tinCount) * Number(formData.tinPrice));
    const handleSubmit = (e) => { e.preventDefault(); onSave({ ...formData, totalRevenue, id: editingSale?.id }); onClose(); };
    return <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg shadow-xl w-full max-w-xl p-6"><h2 className="text-2xl font-bold mb-6">{editingSale ? 'Zeytinyağı Satışını Düzenle' : 'Yeni Zeytinyağı Satışı Ekle'}</h2><form onSubmit={handleSubmit} className="space-y-4"><FormField label="Tarih" id="date" type="date" name="date" value={toInputDateString(formData.date)} onChange={handleChange} required /><FormField label="Müşteri Adı" id="customerName" type="text" name="customerName" value={formData.customerName} onChange={handleChange} required /><FormField label="Teneke Sayısı" id="tinCount" type="number" name="tinCount" value={formData.tinCount} onChange={handleChange} required /><FormField label="Teneke Fiyatı (₺)" id="tinPrice" type="number" name="tinPrice" value={formData.tinPrice} onChange={handleChange} required /><div className="bg-gray-50 p-3 rounded-md"><label>Hesaplanan Satış Geliri</label><p className="font-bold">{formatNumber(totalRevenue, '₺')}</p></div><div className="flex justify-end space-x-3 mt-6"><button type="button" onClick={onClose} className="px-6 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors shadow-sm">İptal</button><button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded">Kaydet</button></div></form></div></div>;
};

const NewTransactionModal = ({ onClose, onSave, customers, editingTransaction, defaultPrices, onSaveDefaultPrices }) => {
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [selectedCustomerOption, setSelectedCustomerOption] = useState(null);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [customDefaults, setCustomDefaults] = useState(defaultPrices);
  const [errorMsg, setErrorMsg] = useState('');

  const [formData, setFormData] = useState({
    date: new Date(),
    oliveKg: '', pricePerKg: defaultPrices.pricePerKg,
    oilLitre: '',
    tinCounts: { s16: '', s10: '', s5: '' },
    tinPrices: { s16: defaultPrices.tinPrices.s16, s10: defaultPrices.tinPrices.s10, s5: defaultPrices.tinPrices.s5 },
    plasticCounts: { s10: '', s5: '', s2: '' },
    plasticPrices: { s10: defaultPrices.plasticPrices.s10, s5: defaultPrices.plasticPrices.s5, s2: defaultPrices.plasticPrices.s2 },
    paymentReceived: '',
    paymentLoss: '', // New field for payment loss
    description: '',
  });

  const customerSearchRef = useRef(null);
  const receiptRef = useRef();

  useEffect(() => {
    const initialTinCounts = { s16: '', s10: '', s5: '' };
    const initialPlasticCounts = { s10: '', s5: '', s2: '' };
    const initialTinPrices = { ...defaultPrices.tinPrices };
    const initialPlasticPrices = { ...defaultPrices.plasticPrices };
    if (editingTransaction) {
      const transactionDate = new Date(editingTransaction.date);
      setFormData({
        date: !isNaN(transactionDate.getTime()) ? transactionDate : new Date(),
        oliveKg: editingTransaction.oliveKg || '',
        pricePerKg: editingTransaction.pricePerKg || defaultPrices.pricePerKg,
        oilLitre: editingTransaction.oilLitre || '',
        tinCounts: { ...initialTinCounts, ...editingTransaction.tinCounts },
        tinPrices: { ...initialTinPrices, ...editingTransaction.tinPrices },
        plasticCounts: { ...initialPlasticCounts, ...editingTransaction.plasticCounts },
        plasticPrices: { ...initialPlasticPrices, ...editingTransaction.plasticPrices },
        paymentReceived: editingTransaction.paymentReceived || '',
        paymentLoss: editingTransaction.paymentLoss || '',
        description: editingTransaction.description || '',
      });
      setCustomerSearchTerm(editingTransaction.customerName || '');
      setSelectedCustomerOption({ id: editingTransaction.customerId, name: editingTransaction.customerName });
    } else {
      setFormData({
        date: new Date(),
        oliveKg: '', pricePerKg: defaultPrices.pricePerKg,
        oilLitre: '',
        tinCounts: initialTinCounts, tinPrices: initialTinPrices,
        plasticCounts: initialPlasticCounts, plasticPrices: initialPlasticPrices,
        paymentReceived: '',
        paymentLoss: '',
        description: '',
      });
      setCustomerSearchTerm('');
      setSelectedCustomerOption(null);
    }
  }, [editingTransaction, defaultPrices]);
  
  useEffect(() => {
      setCustomDefaults(defaultPrices);
  }, [defaultPrices]);

  useEffect(() => {
    const handleClickOutside = (event) => { if (customerSearchRef.current && !customerSearchRef.current.contains(event.target)) setShowCustomerSuggestions(false); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };
  const handleContainerChange = (type, size, value) => {
    setFormData(prev => ({
      ...prev,
      [type]: { ...prev[type], [size]: value }
    }));
  };
  const handleDateChange = (e) => {
    const dateString = e.target.value;
    setFormData(prev => ({
        ...prev,
        date: dateString ? new Date(dateString + 'T00:00:00') : new Date()
    }));
  };
  const handleCustomerSearchChange = (e) => { setCustomerSearchTerm(e.target.value); setSelectedCustomerOption(null); setShowCustomerSuggestions(true); };
  const handleSelectCustomer = (customer) => { setSelectedCustomerOption(customer); setCustomerSearchTerm(customer.name); setShowCustomerSuggestions(false); };
  const handleDefaultsChange = (e) => { const { name, value } = e.target; setCustomDefaults(prev => ({ ...prev, [name]: Number(value) || 0 })); };
  const handleNestedDefaultsChange = (type, size, value) => {
    setCustomDefaults(prev => ({
      ...prev,
      [type]: { ...prev[type], [size]: Number(value) || 0 }
    }));
  };
  const handleSaveDefaults = () => { onSaveDefaultPrices(customDefaults); };

  const filteredCustomerSuggestions = customers.filter(c => c.name.toLowerCase().includes(customerSearchTerm.toLowerCase()));

  const oliveCost = Number(formData.oliveKg) * Number(formData.pricePerKg);
  const tinCost = (Number(formData.tinCounts.s16) * Number(formData.tinPrices.s16)) + (Number(formData.tinCounts.s10) * Number(formData.tinPrices.s10)) + (Number(formData.tinCounts.s5) * Number(formData.tinPrices.s5));
  const plasticCost = (Number(formData.plasticCounts.s10) * Number(formData.plasticPrices.s10)) + (Number(formData.plasticCounts.s5) * Number(formData.plasticPrices.s5)) + (Number(formData.plasticCounts.s2) * Number(formData.plasticPrices.s2));
  const totalCost = roundToTwo(oliveCost + tinCost + plasticCost);
  const oilRatio = Number(formData.oliveKg) > 0 ? (Number(formData.oilLitre) / Number(formData.oliveKg)) : 0;
  const remainingBalance = roundToTwo(totalCost - Number(formData.paymentReceived) - Number(formData.paymentLoss));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customerSearchTerm) { alert('Lütfen müşteri adı giriniz.'); return; }
    setIsLoading(true);
    setErrorMsg('');
    const transactionData = {
      ...formData,
      customerName: customerSearchTerm,
      customerId: selectedCustomerOption?.id || null,
      totalCost,
      oilRatio,
      remainingBalance,
      id: editingTransaction?.id, // Pass the id if editing
    };
    try {
      await onSave(transactionData);
    } catch (err) {
      setErrorMsg(err?.message || 'Kayıt sırasında bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    const printContent = receiptRef.current;
    if (printContent) {
        const printWindow = window.open('', '_blank');
        printWindow.document.write('<html><head><title>İşlem Fişi</title></head><body>');
        printWindow.document.write(printContent.innerHTML);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        setTimeout(() => { // Timeout is sometimes needed to ensure content is loaded
            printWindow.print();
            printWindow.close();
        }, 250);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-600 bg-opacity-75">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-0 md:p-0 relative">
        <div className="sticky top-0 z-10 bg-white rounded-t-2xl px-8 pt-8 pb-4 border-b">
          <h2 className="text-3xl font-bold text-[#556B2F] mb-2">{editingTransaction ? 'İşlemi Düzenle' : 'Yeni İşlem Ekle'}</h2>
        </div>
        {errorMsg && <div className="bg-red-100 text-red-700 px-4 py-2 rounded mb-2 text-center font-semibold">{errorMsg}</div>}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-8 px-8 pb-8 pt-4" style={{ minWidth: 340 }}>
          {/* Üst Bölüm */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <div className="col-span-1">
              <button type="button" onClick={() => setShowSettings(!showSettings)} className="w-full flex justify-between items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border font-semibold text-gray-700 mb-2">
                <span>Varsayılan Fiyatları Ayarla</span>
                {showSettings ? <ChevronUp className="w-5 h-5 text-gray-600" /> : <ChevronDown className="w-5 h-5 text-gray-600" />}
              </button>
              {showSettings && (
                <div className="p-4 space-y-4 border rounded-lg bg-gray-50 mb-2">
                  <div><label className="block text-xs font-medium text-gray-700 mb-1">Kg Başına Ücret (₺)</label><input type="number" name="pricePerKg" value={customDefaults.pricePerKg} onChange={handleDefaultsChange} className="block w-full border-gray-300 rounded-md shadow-sm py-2 px-3"/></div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Teneke Fiyatları (₺)</label>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      <input type="number" value={customDefaults.tinPrices.s16} onChange={e => handleNestedDefaultsChange('tinPrices', 's16', e.target.value)} className="block w-full border-gray-300 rounded-md shadow-sm py-2 px-3" placeholder="16'lık"/>
                      <input type="number" value={customDefaults.tinPrices.s10} onChange={e => handleNestedDefaultsChange('tinPrices', 's10', e.target.value)} className="block w-full border-gray-300 rounded-md shadow-sm py-2 px-3" placeholder="10'luk"/>
                      <input type="number" value={customDefaults.tinPrices.s5} onChange={e => handleNestedDefaultsChange('tinPrices', 's5', e.target.value)} className="block w-full border-gray-300 rounded-md shadow-sm py-2 px-3" placeholder="5'lik"/>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Bidon Fiyatları (₺)</label>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      <input type="number" value={customDefaults.plasticPrices.s10} onChange={e => handleNestedDefaultsChange('plasticPrices', 's10', e.target.value)} className="block w-full border-gray-300 rounded-md shadow-sm py-2 px-3" placeholder="10'luk"/>
                      <input type="number" value={customDefaults.plasticPrices.s5} onChange={e => handleNestedDefaultsChange('plasticPrices', 's5', e.target.value)} className="block w-full border-gray-300 rounded-md shadow-sm py-2 px-3" placeholder="5'lik"/>
                      <input type="number" value={customDefaults.plasticPrices.s2} onChange={e => handleNestedDefaultsChange('plasticPrices', 's2', e.target.value)} className="block w-full border-gray-300 rounded-md shadow-sm py-2 px-3" placeholder="2'lik"/>
                    </div>
                  </div>
                  <div className="flex justify-end"><button type="button" onClick={handleSaveDefaults} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm">Kaydet</button></div>
                </div>
              )}
            </div>
            <div className="col-span-1" ref={customerSearchRef}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Müşteri Adı Soyadı</label>
              <input type="text" value={customerSearchTerm} onChange={handleCustomerSearchChange} onFocus={() => setShowCustomerSuggestions(true)} className="block w-full border rounded-md shadow-sm py-2 px-3" placeholder="Müşteri adı girin veya seçin" required />
              {showCustomerSuggestions && customerSearchTerm && (
                <ul className="absolute z-10 w-full bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto mt-1">
                  {filteredCustomerSuggestions.length > 0 ? filteredCustomerSuggestions.map(c => <li key={c.id} className="px-4 py-2 cursor-pointer hover:bg-gray-100" onClick={() => handleSelectCustomer(c)}>{c.name}</li>) : <li className="px-4 py-2 text-gray-500">Yeni müşteri oluşturulacak.</li>}
                </ul>
              )}
            </div>
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
              <textarea name="description" value={formData.description} onChange={handleChange} className="block w-full border rounded-md shadow-sm py-2 px-3" placeholder="İşlemle ilgili notlar..."/>
            </div>
          </div>

          {/* İşlem Detayları */}
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">İşlem Tarihi</label><input type="date" name="date" value={toInputDateString(formData.date)} onChange={handleDateChange} className="block w-full border rounded-md shadow-sm py-2 px-3" required /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Zeytin Miktarı (kg)</label><input type="number" name="oliveKg" value={formData.oliveKg} onChange={handleChange} className="block w-full border rounded-md shadow-sm py-2 px-3" min="0" step="any" placeholder="Örn: 150.5"/></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Kg Başına Ücret (₺)</label><input type="number" name="pricePerKg" value={formData.pricePerKg} onChange={handleChange} className="block w-full border rounded-md shadow-sm py-2 px-3" min="0" step="any"/></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Çıkan Yağ (litre)</label><input type="number" name="oilLitre" value={formData.oilLitre} onChange={handleChange} className="block w-full border rounded-md shadow-sm py-2 px-3" min="0" step="any" placeholder="Örn: 30.2"/></div>
          </div>

          {/* Tenekeler */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold text-[#556B2F] mb-2">Tenekeler</h3>
            <div className="grid grid-cols-3 gap-4">
              <div><label className="block text-xs font-medium text-gray-700 mb-1">16'lık Sayısı</label><input type="number" value={formData.tinCounts.s16} onChange={e => handleContainerChange('tinCounts', 's16', e.target.value)} className="block w-full border rounded-md shadow-sm py-2 px-3"/></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">10'luk Sayısı</label><input type="number" value={formData.tinCounts.s10} onChange={e => handleContainerChange('tinCounts', 's10', e.target.value)} className="block w-full border rounded-md shadow-sm py-2 px-3"/></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">5'lik Sayısı</label><input type="number" value={formData.tinCounts.s5} onChange={e => handleContainerChange('tinCounts', 's5', e.target.value)} className="block w-full border rounded-md shadow-sm py-2 px-3"/></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">16'lık Fiyatı (₺)</label><input type="number" value={formData.tinPrices.s16} onChange={e => handleContainerChange('tinPrices', 's16', e.target.value)} className="block w-full border rounded-md shadow-sm py-2 px-3"/></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">10'luk Fiyatı (₺)</label><input type="number" value={formData.tinPrices.s10} onChange={e => handleContainerChange('tinPrices', 's10', e.target.value)} className="block w-full border rounded-md shadow-sm py-2 px-3"/></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">5'lik Fiyatı (₺)</label><input type="number" value={formData.tinPrices.s5} onChange={e => handleContainerChange('tinPrices', 's5', e.target.value)} className="block w-full border rounded-md shadow-sm py-2 px-3"/></div>
            </div>
          </div>

          {/* Bidonlar */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold text-[#556B2F] mb-2">Bidonlar</h3>
            <div className="grid grid-cols-3 gap-4">
              <div><label className="block text-xs font-medium text-gray-700 mb-1">10'luk Sayısı</label><input type="number" value={formData.plasticCounts.s10} onChange={e => handleContainerChange('plasticCounts', 's10', e.target.value)} className="block w-full border rounded-md shadow-sm py-2 px-3"/></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">5'lik Sayısı</label><input type="number" value={formData.plasticCounts.s5} onChange={e => handleContainerChange('plasticCounts', 's5', e.target.value)} className="block w-full border rounded-md shadow-sm py-2 px-3"/></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">2'lik Sayısı</label><input type="number" value={formData.plasticCounts.s2} onChange={e => handleContainerChange('plasticCounts', 's2', e.target.value)} className="block w-full border rounded-md shadow-sm py-2 px-3"/></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">10'luk Fiyatı (₺)</label><input type="number" value={formData.plasticPrices.s10} onChange={e => handleContainerChange('plasticPrices', 's10', e.target.value)} className="block w-full border rounded-md shadow-sm py-2 px-3"/></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">5'lik Fiyatı (₺)</label><input type="number" value={formData.plasticPrices.s5} onChange={e => handleContainerChange('plasticPrices', 's5', e.target.value)} className="block w-full border rounded-md shadow-sm py-2 px-3"/></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">2'lik Fiyatı (₺)</label><input type="number" value={formData.plasticPrices.s2} onChange={e => handleContainerChange('plasticPrices', 's2', e.target.value)} className="block w-full border rounded-md shadow-sm py-2 px-3"/></div>
            </div>
          </div>

          {/* Ödeme ve Özet */}
          <div className="border-t pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Alınan Ödeme (₺)</label><input type="number" name="paymentReceived" value={formData.paymentReceived} onChange={handleChange} className="block w-full border rounded-md shadow-sm py-2 px-3" min="0" step="any" placeholder="0"/></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Ödeme Firesi (₺)</label><input type="number" name="paymentLoss" value={formData.paymentLoss} onChange={handleChange} className="block w-full border rounded-md shadow-sm py-2 px-3" min="0" step="any" placeholder="0"/></div>
            </div>
            <div className="bg-gray-50 p-3 rounded-md text-center mt-4">
              <label className="block text-sm font-medium text-gray-700">Yağ Oranı</label>
              <p className="text-lg font-bold text-gray-900">{formatOilRatioDisplay(formData.oliveKg, formData.oilLitre)}</p>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="bg-gray-50 p-3 rounded-md"><label className="block text-xs font-medium text-gray-500">Zeytin Sıkım Ücreti</label><p className="text-lg font-bold text-gray-800">{formatNumber(oliveCost, '₺')}</p></div>
              <div className="bg-gray-50 p-3 rounded-md"><label className="block text-xs font-medium text-gray-500">Toplam Teneke Fiyatı</label><p className="text-lg font-bold text-gray-800">{formatNumber(tinCost, '₺')}</p></div>
              <div className="bg-gray-50 p-3 rounded-md"><label className="block text-xs font-medium text-gray-500">Toplam Bidon Fiyatı</label><p className="text-lg font-bold text-gray-800">{formatNumber(plasticCost, '₺')}</p></div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="bg-blue-50 p-3 rounded-md border border-blue-200"><label className="block text-xs font-medium text-blue-700">Genel Toplam</label><p className="text-xl font-bold text-blue-800">{formatNumber(totalCost, '₺')}</p></div>
              <div className="bg-emerald-50 p-3 rounded-md border border-emerald-200"><label className="block text-xs font-medium text-emerald-700">Alınan Ödeme</label><p className="text-xl font-bold text-emerald-800">{formatNumber(formData.paymentReceived, '₺')}</p></div>
              <div className="bg-red-50 p-3 rounded-md border border-red-200"><label className="block text-xs font-medium text-red-700">Kalan Bakiye</label><p className="text-xl font-bold text-red-800">{formatNumber(remainingBalance, '₺')}</p></div>
            </div>
          </div>

          {/* Footer */}
          <div className="col-span-full flex justify-end space-x-3 mt-6">
            <button type="button" onClick={onClose} className="px-6 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors shadow-sm">İptal</button>
            <button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 shadow-md disabled:opacity-50" disabled={isLoading}>{isLoading ? 'Kaydediliyor...' : 'Kaydet'}</button>
            {/* Adım 2: Yazdır butonu */}
            <button 
              type="button" 
              onClick={handlePrint}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-md"
            >
              Yazdır
            </button>
          </div>
        </form>
        {/* Adım 3: Gizli fiş bileşeni */}
        <div style={{ display: "none" }}>
          <PrintableReceipt 
            ref={receiptRef} 
            transactionData={{
              ...formData,
              customerName: customerSearchTerm,
              totalCost: (
                (Number(formData.oliveKg) || 0) * (Number(formData.pricePerKg) || 0)
                + (Number(formData.tinCounts?.s16 || 0) * Number(formData.tinPrices?.s16 || 0))
                + (Number(formData.tinCounts?.s10 || 0) * Number(formData.tinPrices?.s10 || 0))
                + (Number(formData.tinCounts?.s5 || 0) * Number(formData.tinPrices?.s5 || 0))
                + (Number(formData.plasticCounts?.s10 || 0) * Number(formData.plasticPrices?.s10 || 0))
                + (Number(formData.plasticCounts?.s5 || 0) * Number(formData.plasticPrices?.s5 || 0))
                + (Number(formData.plasticCounts?.s2 || 0) * Number(formData.plasticPrices?.s2 || 0))
              ),
              remainingBalance: roundToTwo(
                (
                  (Number(formData.oliveKg) || 0) * (Number(formData.pricePerKg) || 0)
                  + (Number(formData.tinCounts?.s16 || 0) * Number(formData.tinPrices?.s16 || 0))
                  + (Number(formData.tinCounts?.s10 || 0) * Number(formData.tinPrices?.s10 || 0))
                  + (Number(formData.tinCounts?.s5 || 0) * Number(formData.tinPrices?.s5 || 0))
                  + (Number(formData.plasticCounts?.s10 || 0) * Number(formData.plasticPrices?.s10 || 0))
                  + (Number(formData.plasticCounts?.s5 || 0) * Number(formData.plasticPrices?.s5 || 0))
                  + (Number(formData.plasticCounts?.s2 || 0) * Number(formData.plasticPrices?.s2 || 0))
                  - Number(formData.paymentReceived || 0)
                  - Number(formData.paymentLoss || 0)
                )
              )
            }}
          />
        </div>
      </div>
    </div>
  );
};

const ConfirmationModal = ({ message, onConfirm, onCancel, isLoading }) => (
  <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 relative">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Onay Gerekli</h3>
      <p className="text-gray-700 mb-6">{message}</p>
      <div className="flex justify-end space-x-3">
        <button onClick={onCancel} className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50 shadow-sm" disabled={isLoading}>İptal</button>
        <button 
          onClick={onConfirm} 
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 shadow-md disabled:opacity-50 disabled:cursor-wait"
          disabled={isLoading}
        >
          {isLoading ? 'Siliniyor...' : 'Onayla'}
        </button>
      </div>
    </div>
  </div>
);

const FactoryExpenses = ({ workerExpenses, factoryOverhead, pomaceRevenues, tinPurchases, plasticPurchases, onSaveWorkerExpense, onSaveFactoryOverhead, onSavePomaceRevenue, onSaveTinPurchase, onSavePlasticPurchase, onDeleteItem }) => {
  const [showWorkerExpenseModal, setShowWorkerExpenseModal] = useState(false);
  const [editingWorkerExpense, setEditingWorkerExpense] = useState(null);
  const [showMiscellaneousExpenseModal, setShowMiscellaneousExpenseModal] = useState(false);
  const [editingMiscellaneousExpense, setEditingMiscellaneousExpense] = useState(null);
  const [showPomaceRevenueModal, setShowPomaceRevenueModal] = useState(false);
  const [editingPomaceRevenue, setEditingPomaceRevenue] = useState(null);
  const [showTinPurchaseModal, setShowTinPurchaseModal] = useState(false);
  const [editingTinPurchase, setEditingTinPurchase] = useState(null);
  const [showPlasticPurchaseModal, setShowPlasticPurchaseModal] = useState(false);
  const [editingPlasticPurchase, setEditingPlasticPurchase] = useState(null);

  const handleOpenModal = (type, item = null) => {
    if (type === 'worker') { setEditingWorkerExpense(item); setShowWorkerExpenseModal(true); }
    if (type === 'overhead') { setEditingMiscellaneousExpense(item); setShowMiscellaneousExpenseModal(true); }
    if (type === 'pomace') { setEditingPomaceRevenue(item); setShowPomaceRevenueModal(true); }
    if (type === 'tin') { setEditingTinPurchase(item); setShowTinPurchaseModal(true); }
    if (type === 'plastic') { setEditingPlasticPurchase(item); setShowPlasticPurchaseModal(true); }
  };

  const handleCloseModals = () => {
    setShowWorkerExpenseModal(false); setEditingWorkerExpense(null);
    setShowMiscellaneousExpenseModal(false); setEditingMiscellaneousExpense(null);
    setShowPomaceRevenueModal(false); setEditingPomaceRevenue(null);
    setShowTinPurchaseModal(false); setEditingTinPurchase(null);
    setShowPlasticPurchaseModal(false); setEditingPlasticPurchase(null);
  };

  const handleSaveAndClose = async (type, data) => {
    if (type === 'worker') await onSaveWorkerExpense(data);
    if (type === 'overhead') await onSaveFactoryOverhead(data);
    if (type === 'pomace') await onSavePomaceRevenue(data);
    if (type === 'tin') await onSaveTinPurchase(data);
    if (type === 'plastic') await onSavePlasticPurchase(data);
    handleCloseModals();
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-700 mb-4">Giderler ve Diğer Gelirler</h1>
      
      <ExpenseTable title="İşçi Harcamaları" data={workerExpenses} onAddItem={() => handleOpenModal('worker')} onEditItem={(item) => handleOpenModal('worker', item)} onDeleteItem={(id) => onDeleteItem('workerExpenses', id)} columns={['Tarih', 'İşçi Adı', 'Çalıştığı Gün', 'Verilen Ücret (₺)', 'Açıklama']} fields={['date', 'workerName', 'daysWorked', 'amount', 'description']} />
      <ExpenseTable title="Muhtelif Giderler" data={factoryOverhead} onAddItem={() => handleOpenModal('overhead')} onEditItem={(item) => handleOpenModal('overhead', item)} onDeleteItem={(id) => onDeleteItem('factoryOverhead', id)} columns={['Tarih', 'Açıklama', 'Gider Tutarı (₺)']} fields={['date', 'description', 'amount']} />
      <ExpenseTable title="Teneke Alımları" data={tinPurchases} onAddItem={() => handleOpenModal('tin')} onEditItem={(item) => handleOpenModal('tin', item)} onDeleteItem={(id) => onDeleteItem('tinPurchases', id)} columns={['Tarih', '16\'lık', '10\'luk', '5\'lik', 'Toplam Maliyet', 'Açıklama']} fields={['date', 's16', 's10', 's5', 'totalCost', 'description']} />
      <ExpenseTable title="Bidon Alımları" data={plasticPurchases} onAddItem={() => handleOpenModal('plastic')} onEditItem={(item) => handleOpenModal('plastic', item)} onDeleteItem={(id) => onDeleteItem('plasticPurchases', id)} columns={['Tarih', '10\'luk', '5\'lik', '2\'lik', 'Toplam Maliyet', 'Açıklama']} fields={['date', 's10', 's5', 's2', 'totalCost', 'description']} />
      <ExpenseTable title="Pirina Geliri" data={pomaceRevenues} onAddItem={() => handleOpenModal('pomace')} onEditItem={(item) => handleOpenModal('pomace', item)} onDeleteItem={(id) => onDeleteItem('pomaceRevenues', id)} columns={['Tarih', 'Tır Sayısı', 'Toplam Yük (kg)', 'Kg Başına Ücret (₺)', 'Toplam Gelir (₺)', 'Açıklama']} fields={['date', 'truckCount', 'loadKg', 'pricePerKg', 'totalRevenue', 'description']} />

      {showWorkerExpenseModal && <WorkerExpenseModal onClose={handleCloseModals} onSave={(data) => handleSaveAndClose('worker', data)} editingExpense={editingWorkerExpense} />}
      {showMiscellaneousExpenseModal && <MiscellaneousExpenseModal onClose={handleCloseModals} onSave={(data) => handleSaveAndClose('overhead', data)} editingExpense={editingMiscellaneousExpense} />}
      {showPomaceRevenueModal && <PomaceRevenueModal onClose={handleCloseModals} onSave={(data) => handleSaveAndClose('pomace', data)} editingRevenue={editingPomaceRevenue} />}
      {showTinPurchaseModal && <TinPurchaseModal onClose={handleCloseModals} onSave={(data) => handleSaveAndClose('tin', data)} editingPurchase={editingTinPurchase} />}
      {showPlasticPurchaseModal && <PlasticPurchaseModal onClose={handleCloseModals} onSave={(data) => handleSaveAndClose('plastic', data)} editingPurchase={editingPlasticPurchase} />}
    </div>
  );
};

const ExpenseTable = ({ title, data, onAddItem, onEditItem, onDeleteItem, columns, fields }) => {
  const [limit, setLimit] = useState(5); // Her tablonun kendi limiti olacak
  const sortedData = data.sort((a, b) => new Date(b.date) - new Date(a.date));
  const limitedData = limit === 'all' ? sortedData : sortedData.slice(0, Number(limit));

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
            <div className="flex items-center space-x-4">
                <select 
                    value={limit} 
                    onChange={(e) => setLimit(e.target.value)} 
                    className="border rounded px-3 py-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                >
                    <option value={5}>Son 5</option>
                    <option value={10}>Son 10</option>
                    <option value={25}>Son 25</option>
                    <option value="all">Tümü</option>
                </select>
                <button onClick={onAddItem} className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-md">
                    <Plus className="w-5 h-5" />
                    <span>{title.replace('ları', '').replace('ler', '')} Ekle</span>
                </button>
            </div>
        </div>
        {data.length === 0 ? <p className="text-gray-500">Henüz kayıt bulunmamaktadır.</p> : (
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            {columns.map(col => <th key={col} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{col}</th>)}
                            <th className="px-6 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {limitedData.map(item => (
                            <tr key={item.id}>
                                {fields.map(field => <td key={field} className="px-6 py-4 whitespace-nowrap text-sm">{field === 'date' ? new Date(item[field]).toLocaleDateString() : (typeof item[field] === 'number' ? formatNumber(item[field], field.toLowerCase().includes('fiyat') || field.toLowerCase().includes('maliyet') || field.toLowerCase().includes('gelir') || field.toLowerCase().includes('ücret') || field.toLowerCase().includes('tutar') ? '₺' : '') : item[field] || 'N/A')}</td>)}
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => onEditItem(item)} className="p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 hover:text-gray-800 transition-colors">
                                        <Edit className="w-5 h-5" />
                                    </button>
                                    <button onClick={() => onDeleteItem(item.id)} className="ml-2 p-2 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
    </div>
  );
};

const WorkerExpenseModal = ({ onClose, onSave, editingExpense }) => {
  const [formData, setFormData] = useState({ date: new Date(), description: '', amount: '', workerName: '', daysWorked: '' });
  useEffect(() => { if (editingExpense) { const d = new Date(editingExpense.date); setFormData({ ...editingExpense, date: !isNaN(d.getTime()) ? d : new Date() }); } }, [editingExpense]);
  const handleChange = (e) => { const { name, value } = e.target; setFormData(p => ({ ...p, [name]: value })); };
  const handleSubmit = (e) => { e.preventDefault(); onSave({ ...formData, id: editingExpense?.id }); };
  return <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg shadow-xl w-full max-w-xl p-6"><h2 className="text-2xl font-bold mb-6">{editingExpense ? 'İşçi Harcamasını Düzenle' : 'Yeni İşçi Harcaması Ekle'}</h2><form onSubmit={handleSubmit} className="space-y-4"><FormField label="Tarih" id="date" type="date" name="date" value={toInputDateString(formData.date)} onChange={handleChange} required /><FormField label="İşçi Adı" id="workerName" type="text" name="workerName" value={formData.workerName} onChange={handleChange} required /><FormField label="Çalıştığı Gün Sayısı" id="daysWorked" type="number" name="daysWorked" value={formData.daysWorked} onChange={handleChange} /><FormField label="Verilen Ücret (₺)" id="amount" type="number" name="amount" value={formData.amount} onChange={handleChange} required /><TextAreaField label="Açıklama" id="description" name="description" value={formData.description} onChange={handleChange} /> <div className="flex justify-end space-x-3 mt-6"><button type="button" onClick={onClose} className="px-6 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors shadow-sm">İptal</button><button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded">Kaydet</button></div></form></div></div>;
};
const MiscellaneousExpenseModal = ({ onClose, onSave, editingExpense }) => {
  const [formData, setFormData] = useState({ date: new Date(), description: '', amount: '' });
  useEffect(() => { if (editingExpense) { const d = new Date(editingExpense.date); setFormData({ ...editingExpense, date: !isNaN(d.getTime()) ? d : new Date() }); } }, [editingExpense]);
  const handleChange = (e) => { const { name, value } = e.target; setFormData(p => ({ ...p, [name]: value })); };
  const handleQuickAdd = (desc) => { setFormData(p => ({ ...p, description: p.description ? `${p.description}, ${desc}`: desc }))};
  const handleSubmit = (e) => { e.preventDefault(); onSave({ ...formData, id: editingExpense?.id }); };
  const quickAddItems = ['Elektrik', 'Su', 'Yemek', 'Yakıt'];
  return <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg shadow-xl w-full max-w-xl p-6"><h2 className="text-2xl font-bold mb-6">{editingExpense ? 'Muhtelif Gideri Düzenle' : 'Yeni Muhtelif Gider Ekle'}</h2><form onSubmit={handleSubmit} className="space-y-4"> <div className="space-x-2 mb-2">{quickAddItems.map(item => <button type="button" key={item} onClick={() => handleQuickAdd(item)} className="px-3 py-1 text-sm bg-gray-100 text-gray-700 border border-gray-300 rounded-full hover:bg-gray-200 transition-colors">{item}</button>)}</div><FormField label="Tarih" id="date" type="date" name="date" value={toInputDateString(formData.date)} onChange={handleChange} required /><TextAreaField label="Açıklama" id="description" name="description" value={formData.description} onChange={handleChange} required rows="3" /><FormField label="Gider Tutarı (₺)" id="amount" type="number" name="amount" value={formData.amount} onChange={handleChange} required /><div className="flex justify-end space-x-3 mt-6"><button type="button" onClick={onClose} className="px-6 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors shadow-sm">İptal</button><button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded">Kaydet</button></div></form></div></div>;
};
const PomaceRevenueModal = ({ onClose, onSave, editingRevenue }) => {
  const [formData, setFormData] = useState({ date: new Date(), truckCount: '', loadKg: '', pricePerKg: '', description: '' });
  useEffect(() => { if (editingRevenue) { const d = new Date(editingRevenue.date); setFormData({ ...editingRevenue, date: !isNaN(d.getTime()) ? d : new Date() }); } }, [editingRevenue]);
  const handleChange = (e) => { const { name, value } = e.target; setFormData(p => ({ ...p, [name]: value })); };
  const totalRevenue = roundToTwo(Number(formData.loadKg) * Number(formData.pricePerKg));
  const handleSubmit = (e) => { e.preventDefault(); onSave({ ...formData, totalRevenue, id: editingRevenue?.id }); };
  return <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg shadow-xl w-full max-w-xl p-6"><h2 className="text-2xl font-bold mb-6">{editingRevenue ? 'Pirina Gelirini Düzenle' : 'Yeni Pirina Geliri Ekle'}</h2><form onSubmit={handleSubmit} className="space-y-4"><FormField label="Tarih" id="date" type="date" name="date" value={toInputDateString(formData.date)} onChange={handleChange} required /><FormField label="Giden Tır Sayısı" id="truckCount" type="number" name="truckCount" value={formData.truckCount} onChange={handleChange} required /><FormField label="Toplam Yük (kg)" id="loadKg" type="number" name="loadKg" value={formData.loadKg} onChange={handleChange} required /><FormField label="Kg Başına Ücret (₺)" id="pricePerKg" type="number" name="pricePerKg" value={formData.pricePerKg} onChange={handleChange} required /><TextAreaField label="Açıklama (örn: Firma Adı)" id="description" name="description" value={formData.description} onChange={handleChange} /><div className="bg-gray-50 p-3 rounded-md"><label>Hesaplanan Toplam Gelir</label><p className="font-bold">{formatNumber(totalRevenue, '₺')}</p></div><div className="flex justify-end space-x-3 mt-6"><button type="button" onClick={onClose} className="px-6 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors shadow-sm">İptal</button><button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded">Kaydet</button></div></form></div></div>;
};

const TinPurchaseModal = ({ onClose, onSave, editingPurchase }) => {
  const [formData, setFormData] = useState({ date: new Date(), description: '', s16: '', s10: '', s5: '', tinPrice: '' });
  useEffect(() => { if (editingPurchase) { const d = new Date(editingPurchase.date); setFormData({ ...editingPurchase, date: !isNaN(d.getTime()) ? d : new Date() }); } }, [editingPurchase]);
  const handleChange = (e) => { const { name, value } = e.target; setFormData(p => ({ ...p, [name]: value })); };
  const totalCount = (Number(formData.s16) || 0) + (Number(formData.s10) || 0) + (Number(formData.s5) || 0);
  const totalCost = roundToTwo(totalCount * Number(formData.tinPrice));
  const handleSubmit = (e) => { e.preventDefault(); onSave({ ...formData, totalCost, id: editingPurchase?.id }); };
  return <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg shadow-xl w-full max-w-xl p-6"><h2 className="text-2xl font-bold mb-6">{editingPurchase ? 'Teneke Alımını Düzenle' : 'Yeni Teneke Alımı Ekle'}</h2><form onSubmit={handleSubmit} className="space-y-4"><FormField label="Tarih" id="date" type="date" name="date" value={toInputDateString(formData.date)} onChange={handleChange} required /><div className="grid grid-cols-3 gap-4"><FormField label="16'lık Sayısı" id="s16" type="number" name="s16" value={formData.s16} onChange={handleChange} /><FormField label="10'luk Sayısı" id="s10" type="number" name="s10" value={formData.s10} onChange={handleChange} /><FormField label="5'lik Sayısı" id="s5" type="number" name="s5" value={formData.s5} onChange={handleChange} /></div><FormField label="Birim Fiyat (₺)" id="tinPrice" type="number" name="tinPrice" value={formData.tinPrice} onChange={handleChange} required /><TextAreaField label="Açıklama (örn: Satıcı Firma)" id="description" name="description" value={formData.description} onChange={handleChange} /><div className="bg-gray-50 p-3 rounded-md"><label>Hesaplanan Toplam Maliyet</label><p className="font-bold">{formatNumber(totalCost, '₺')}</p></div><div className="flex justify-end space-x-3 mt-6"><button type="button" onClick={onClose} className="px-6 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors shadow-sm">İptal</button><button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded">Kaydet</button></div></form></div></div>;
};

const PlasticPurchaseModal = ({ onClose, onSave, editingPurchase }) => {
  const [formData, setFormData] = useState({ date: new Date(), description: '', s10: '', s5: '', s2: '', plasticPrice: '' });
  useEffect(() => { if (editingPurchase) { const d = new Date(editingPurchase.date); setFormData({ ...editingPurchase, date: !isNaN(d.getTime()) ? d : new Date() }); } }, [editingPurchase]);
  const handleChange = (e) => { const { name, value } = e.target; setFormData(p => ({ ...p, [name]: value })); };
  const totalCount = (Number(formData.s10) || 0) + (Number(formData.s5) || 0) + (Number(formData.s2) || 0);
  const totalCost = roundToTwo(totalCount * Number(formData.plasticPrice));
  const handleSubmit = (e) => { e.preventDefault(); onSave({ ...formData, totalCost, id: editingPurchase?.id }); };
  return <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg shadow-xl w-full max-w-xl p-6"><h2 className="text-2xl font-bold mb-6">{editingPurchase ? 'Bidon Alımını Düzenle' : 'Yeni Bidon Alımı Ekle'}</h2><form onSubmit={handleSubmit} className="space-y-4"><FormField label="Tarih" id="date" type="date" name="date" value={toInputDateString(formData.date)} onChange={handleChange} required /><div className="grid grid-cols-3 gap-4"><FormField label="10'luk Sayısı" id="s10" type="number" name="s10" value={formData.s10} onChange={handleChange} /><FormField label="5'lik Sayısı" id="s5" type="number" name="s5" value={formData.s5} onChange={handleChange} /><FormField label="2'lik Sayısı" id="s2" type="number" name="s2" value={formData.s2} onChange={handleChange} /></div><FormField label="Birim Fiyat (₺)" id="plasticPrice" type="number" name="plasticPrice" value={formData.plasticPrice} onChange={handleChange} required /><TextAreaField label="Açıklama (örn: Satıcı Firma)" id="description" name="description" value={formData.description} onChange={handleChange} /><div className="bg-gray-50 p-3 rounded-md"><label>Hesaplanan Toplam Maliyet</label><p className="font-bold">{formatNumber(totalCost, '₺')}</p></div><div className="flex justify-end space-x-3 mt-6"><button type="button" onClick={onClose} className="px-6 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors shadow-sm">İptal</button><button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded">Kaydet</button></div></form></div></div>;
};

const PaymentCollectionModal = ({ customer, onClose, onSavePayment }) => {
  const [amount, setAmount] = useState('');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (Number(amount) > 0) {
      alert('Lütfen geçerli bir tutar girin.');
    }
    //alert('Lütfen geçerli bir tutar girin.');
    if (Number(amount) > 0) {
      onSavePayment(customer.id, customer.name, amount);
    } else {
      // Custom Modal
      // alert('Lütfen geçerli bir tutar girin.');
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-2xl font-bold mb-4">Tahsilat Yap</h2>
        <p className="mb-4">Müşteri: <span className="font-semibold">{customer.name}</span></p>
        <p className="mb-4">Mevcut Bakiye: <span className="font-semibold">{formatNumber(customer.remainingBalance, '₺')}</span></p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="paymentAmount" className="block text-sm font-medium text-gray-700 mb-1">Tahsil Edilen Tutar (₺)</label>
            <input 
              type="number" 
              id="paymentAmount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Tutar girin" 
              className="w-full border rounded p-2" 
              required 
              autoFocus
            />
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button type="button" onClick={onClose} className="px-6 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors shadow-sm">İptal</button>
            <button type="submit" className="px-6 py-2 bg-green-600 text-white rounded">Tahsil Et</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const StockPage = ({ tinPurchases, plasticPurchases, transactions }) => {
  // Stok adetleri
  const stock = {
    tin: { s16: { purchased: 0, used: 0 }, s10: { purchased: 0, used: 0 }, s5: { purchased: 0, used: 0 } },
    plastic: { s10: { purchased: 0, used: 0 }, s5: { purchased: 0, used: 0 }, s2: { purchased: 0, used: 0 } },
  };

  tinPurchases.forEach(p => {
    stock.tin.s16.purchased += Number(p.s16 || 0);
    stock.tin.s10.purchased += Number(p.s10 || 0);
    stock.tin.s5.purchased += Number(p.s5 || 0);
  });

  plasticPurchases.forEach(p => {
    stock.plastic.s10.purchased += Number(p.s10 || 0);
    stock.plastic.s5.purchased += Number(p.s5 || 0);
    stock.plastic.s2.purchased += Number(p.s2 || 0);
  });

  transactions.forEach(t => {
    stock.tin.s16.used += Number(t.tinCounts?.s16 || 0);
    stock.tin.s10.used += Number(t.tinCounts?.s10 || 0);
    stock.tin.s5.used += Number(t.tinCounts?.s5 || 0);
    stock.plastic.s10.used += Number(t.plasticCounts?.s10 || 0);
    stock.plastic.s5.used += Number(t.plasticCounts?.s5 || 0);
    stock.plastic.s2.used += Number(t.plasticCounts?.s2 || 0);
  });
  // --- Detaylı maliyet hesaplama fonksiyonu ---
  function hesaplaDetayliStokDegeri(tinPurchases, transactions) {
    let toplamAlinan = { s16: 0, s10: 0, s5: 0 };
    let toplamMaliyet = { s16: 0, s10: 0, s5: 0 };
    tinPurchases.forEach(p => {
      toplamAlinan.s16 += Number(p.s16 || 0);
      toplamAlinan.s10 += Number(p.s10 || 0);
      toplamAlinan.s5 += Number(p.s5 || 0);
      toplamMaliyet.s16 += (Number(p.s16 || 0) * Number(p.tinPrice || 0));
      toplamMaliyet.s10 += (Number(p.s10 || 0) * Number(p.tinPrice || 0));
      toplamMaliyet.s5 += (Number(p.s5 || 0) * Number(p.tinPrice || 0));
    });
    const ortMaliyet = {
      s16: toplamAlinan.s16 > 0 ? toplamMaliyet.s16 / toplamAlinan.s16 : 0,
      s10: toplamAlinan.s10 > 0 ? toplamMaliyet.s10 / toplamAlinan.s10 : 0,
      s5: toplamAlinan.s5 > 0 ? toplamMaliyet.s5 / toplamAlinan.s5 : 0,
    };
    let kullanilan = { s16: 0, s10: 0, s5: 0 };
    transactions.forEach(t => {
      kullanilan.s16 += Number(t.tinCounts?.s16 || 0);
      kullanilan.s10 += Number(t.tinCounts?.s10 || 0);
      kullanilan.s5 += Number(t.tinCounts?.s5 || 0);
    });
    let kalan = {
      s16: toplamAlinan.s16 - kullanilan.s16,
      s10: toplamAlinan.s10 - kullanilan.s10,
      s5: toplamAlinan.s5 - kullanilan.s5,
    };
    return {
      s16: { maliyet_alinan: toplamAlinan.s16 * ortMaliyet.s16, maliyet_kullanilan: kullanilan.s16 * ortMaliyet.s16, maliyet_kalan: kalan.s16 * ortMaliyet.s16 },
      s10: { maliyet_alinan: toplamAlinan.s10 * ortMaliyet.s10, maliyet_kullanilan: kullanilan.s10 * ortMaliyet.s10, maliyet_kalan: kalan.s10 * ortMaliyet.s10 },
      s5: { maliyet_alinan: toplamAlinan.s5 * ortMaliyet.s5, maliyet_kullanilan: kullanilan.s5 * ortMaliyet.s5, maliyet_kalan: kalan.s5 * ortMaliyet.s5 },
    };
  }

  const detayliStokMaliyet = hesaplaDetayliStokDegeri(tinPurchases, transactions);

  // --- Detaylı bidon stok maliyeti hesaplama fonksiyonu ---
  function hesaplaDetayliBidonStokDegeri(plasticPurchases, transactions) {
    let toplamAlinan = { s10: 0, s5: 0, s2: 0 };
    let toplamMaliyet = { s10: 0, s5: 0, s2: 0 };
    plasticPurchases.forEach(p => {
      toplamAlinan.s10 += Number(p.s10 || 0);
      toplamAlinan.s5 += Number(p.s5 || 0);
      toplamAlinan.s2 += Number(p.s2 || 0);
      toplamMaliyet.s10 += (Number(p.s10 || 0) * Number(p.plasticPrice || 0));
      toplamMaliyet.s5 += (Number(p.s5 || 0) * Number(p.plasticPrice || 0));
      toplamMaliyet.s2 += (Number(p.s2 || 0) * Number(p.plasticPrice || 0));
    });
    const ortMaliyet = {
      s10: toplamAlinan.s10 > 0 ? toplamMaliyet.s10 / toplamAlinan.s10 : 0,
      s5: toplamAlinan.s5 > 0 ? toplamMaliyet.s5 / toplamAlinan.s5 : 0,
      s2: toplamAlinan.s2 > 0 ? toplamMaliyet.s2 / toplamAlinan.s2 : 0,
    };
    let kullanilan = { s10: 0, s5: 0, s2: 0 };
    transactions.forEach(t => {
      kullanilan.s10 += Number(t.plasticCounts?.s10 || 0);
      kullanilan.s5 += Number(t.plasticCounts?.s5 || 0);
      kullanilan.s2 += Number(t.plasticCounts?.s2 || 0);
    });
    let kalan = {
      s10: toplamAlinan.s10 - kullanilan.s10,
      s5: toplamAlinan.s5 - kullanilan.s5,
      s2: toplamAlinan.s2 - kullanilan.s2,
    };
    return {
      s10: { maliyet_alinan: toplamAlinan.s10 * ortMaliyet.s10, maliyet_kullanilan: kullanilan.s10 * ortMaliyet.s10, maliyet_kalan: kalan.s10 * ortMaliyet.s10 },
      s5: { maliyet_alinan: toplamAlinan.s5 * ortMaliyet.s5, maliyet_kullanilan: kullanilan.s5 * ortMaliyet.s5, maliyet_kalan: kalan.s5 * ortMaliyet.s5 },
      s2: { maliyet_alinan: toplamAlinan.s2 * ortMaliyet.s2, maliyet_kullanilan: kullanilan.s2 * ortMaliyet.s2, maliyet_kalan: kalan.s2 * ortMaliyet.s2 },
    };
  }

  const detayliBidonStokMaliyet = hesaplaDetayliBidonStokDegeri(plasticPurchases, transactions);

  // Kalan stokların toplam maliyetini hesapla
  const toplamTenekeKalanMaliyet = Object.values(detayliStokMaliyet).reduce((sum, v) => sum + (v.maliyet_kalan || 0), 0);
  const toplamBidonKalanMaliyet = Object.values(detayliBidonStokMaliyet).reduce((sum, v) => sum + (v.maliyet_kalan || 0), 0);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Stok Durumu</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center"><Package className="w-6 h-6 mr-2 text-orange-500" />Teneke Stok Durumu</h2>
          <div className="space-y-6 mt-4">
            {Object.keys(stock.tin).map(size => (
              <div key={size}>
                <h3 className="text-lg font-semibold text-gray-600 border-b pb-2 mb-2">{size.replace('s', "")}'luk Teneke</h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-gray-500">Alınan</p>
                    <p className="text-2xl font-bold">{formatNumber(stock.tin[size].purchased)}</p>
                    <p style={{ fontSize: '0.95rem', color: '#555', marginTop: 2 }}>{formatNumber(detayliStokMaliyet[size].maliyet_alinan, '₺')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Kullanılan</p>
                    <p className="text-2xl font-bold">{formatNumber(stock.tin[size].used)}</p>
                    <p style={{ fontSize: '0.95rem', color: '#555', marginTop: 2 }}>{formatNumber(detayliStokMaliyet[size].maliyet_kullanilan, '₺')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Kalan</p>
                    <p className="text-2xl font-bold text-green-600">{formatNumber(stock.tin[size].purchased - stock.tin[size].used)}</p>
                    <p style={{ fontSize: '0.95rem', color: '#555', marginTop: 2 }}>{formatNumber(detayliStokMaliyet[size].maliyet_kalan, '₺')}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Toplam kalan teneke stok maliyeti kartı */}
          <div className="mt-8 bg-orange-50 border border-orange-200 rounded-lg p-4 flex flex-col items-center">
            <span className="text-base font-semibold text-orange-700 mb-1">Toplam Kalan Teneke Stok Değeri</span>
            <span className="text-2xl font-bold text-orange-900">{formatNumber(toplamTenekeKalanMaliyet, '₺')}</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center"><Package className="w-6 h-6 mr-2 text-teal-500" />Bidon Stok Durumu</h2>
          <div className="space-y-6 mt-4">
            {Object.keys(stock.plastic).map(size => (
              <div key={size}>
                <h3 className="text-lg font-semibold text-gray-600 border-b pb-2 mb-2">{size.replace('s', "")}'luk Bidon</h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-gray-500">Alınan</p>
                    <p className="text-2xl font-bold">{formatNumber(stock.plastic[size].purchased)}</p>
                    <p style={{ fontSize: '0.95rem', color: '#555', marginTop: 2 }}>{formatNumber(detayliBidonStokMaliyet[size].maliyet_alinan, '₺')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Kullanılan</p>
                    <p className="text-2xl font-bold">{formatNumber(stock.plastic[size].used)}</p>
                    <p style={{ fontSize: '0.95rem', color: '#555', marginTop: 2 }}>{formatNumber(detayliBidonStokMaliyet[size].maliyet_kullanilan, '₺')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Kalan</p>
                    <p className="text-2xl font-bold text-green-600">{formatNumber(stock.plastic[size].purchased - stock.plastic[size].used)}</p>
                    <p style={{ fontSize: '0.95rem', color: '#555', marginTop: 2 }}>{formatNumber(detayliBidonStokMaliyet[size].maliyet_kalan, '₺')}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Toplam kalan bidon stok maliyeti kartı */}
          <div className="mt-8 bg-teal-50 border border-teal-200 rounded-lg p-4 flex flex-col items-center">
            <span className="text-base font-semibold text-teal-700 mb-1">Toplam Kalan Bidon Stok Değeri</span>
            <span className="text-2xl font-bold text-teal-900">{formatNumber(toplamBidonKalanMaliyet, '₺')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// SummaryCard componentini ekliyorum
const SummaryCard = ({ title, value, icon, children, iconColorClass = 'text-gray-600' }) => (
  <div className="bg-white p-6 rounded-lg shadow-md flex flex-col justify-between min-h-[120px] transition-transform hover:scale-105">
    <div>
      <div className="flex items-center">
        <div className={`p-3 rounded-full bg-gray-100 mr-4 text-2xl ${iconColorClass}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-gray-600 font-semibold">{title}</p>
          <p className="text-2xl font-bold text-gray-800">{value}</p>
        </div>
      </div>
    </div>
    {children && (
      <div className="mt-4 border-t pt-2 text-sm text-gray-500 space-y-1">
        {children}
      </div>
    )}
  </div>
);

// Dashboard bileşeninin üstüne ekleniyor:
function calculateFactorySummary({ transactions, workerExpenses, factoryOverhead, pomaceRevenues, tinPurchases, plasticPurchases }) {
  const totalBilledAmount = transactions.reduce((sum, t) => sum + Number(t.totalCost || 0), 0);
  const totalPomaceRevenues = pomaceRevenues.reduce((sum, r) => sum + Number(r.totalRevenue || 0), 0);
  const totalPaymentLoss = transactions.reduce((sum, t) => sum + Number(t.paymentLoss || 0), 0);
  const totalWorkerExpenses = workerExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const totalFactoryOverhead = factoryOverhead.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const totalTinPurchaseCost = tinPurchases.reduce((sum, p) => sum + Number(p.totalCost || 0), 0);
  const totalPlasticPurchaseCost = plasticPurchases.reduce((sum, p) => sum + Number(p.totalCost || 0), 0);
  // Stok maliyetlerini hesapla
  function hesaplaDetayliStokDegeri(tinPurchases, transactions) {
    let toplamAlinan = { s16: 0, s10: 0, s5: 0 };
    let toplamMaliyet = { s16: 0, s10: 0, s5: 0 };
    tinPurchases.forEach(p => {
      toplamAlinan.s16 += Number(p.s16 || 0);
      toplamAlinan.s10 += Number(p.s10 || 0);
      toplamAlinan.s5 += Number(p.s5 || 0);
      toplamMaliyet.s16 += (Number(p.s16 || 0) * Number(p.tinPrice || 0));
      toplamMaliyet.s10 += (Number(p.s10 || 0) * Number(p.tinPrice || 0));
      toplamMaliyet.s5 += (Number(p.s5 || 0) * Number(p.tinPrice || 0));
    });
    const ortMaliyet = {
      s16: toplamAlinan.s16 > 0 ? toplamMaliyet.s16 / toplamAlinan.s16 : 0,
      s10: toplamAlinan.s10 > 0 ? toplamMaliyet.s10 / toplamAlinan.s10 : 0,
      s5: toplamAlinan.s5 > 0 ? toplamMaliyet.s5 / toplamAlinan.s5 : 0,
    };
    let kullanilan = { s16: 0, s10: 0, s5: 0 };
    transactions.forEach(t => {
      kullanilan.s16 += Number(t.tinCounts?.s16 || 0);
      kullanilan.s10 += Number(t.tinCounts?.s10 || 0);
      kullanilan.s5 += Number(t.tinCounts?.s5 || 0);
    });
    let kalan = {
      s16: toplamAlinan.s16 - kullanilan.s16,
      s10: toplamAlinan.s10 - kullanilan.s10,
      s5: toplamAlinan.s5 - kullanilan.s5,
    };
    return {
      s16: { maliyet_kalan: kalan.s16 * ortMaliyet.s16 },
      s10: { maliyet_kalan: kalan.s10 * ortMaliyet.s10 },
      s5: { maliyet_kalan: kalan.s5 * ortMaliyet.s5 },
    };
  }
  function hesaplaDetayliBidonStokDegeri(plasticPurchases, transactions) {
    let toplamAlinan = { s10: 0, s5: 0, s2: 0 };
    let toplamMaliyet = { s10: 0, s5: 0, s2: 0 };
    plasticPurchases.forEach(p => {
      toplamAlinan.s10 += Number(p.s10 || 0);
      toplamAlinan.s5 += Number(p.s5 || 0);
      toplamAlinan.s2 += Number(p.s2 || 0);
      toplamMaliyet.s10 += (Number(p.s10 || 0) * Number(p.plasticPrice || 0));
      toplamMaliyet.s5 += (Number(p.s5 || 0) * Number(p.plasticPrice || 0));
      toplamMaliyet.s2 += (Number(p.s2 || 0) * Number(p.plasticPrice || 0));
    });
    const ortMaliyet = {
      s10: toplamAlinan.s10 > 0 ? toplamMaliyet.s10 / toplamAlinan.s10 : 0,
      s5: toplamAlinan.s5 > 0 ? toplamMaliyet.s5 / toplamAlinan.s5 : 0,
      s2: toplamAlinan.s2 > 0 ? toplamMaliyet.s2 / toplamAlinan.s2 : 0,
    };
    let kullanilan = { s10: 0, s5: 0, s2: 0 };
    transactions.forEach(t => {
      kullanilan.s10 += Number(t.plasticCounts?.s10 || 0);
      kullanilan.s5 += Number(t.plasticCounts?.s5 || 0);
      kullanilan.s2 += Number(t.plasticCounts?.s2 || 0);
    });
    let kalan = {
      s10: toplamAlinan.s10 - kullanilan.s10,
      s5: toplamAlinan.s5 - kullanilan.s5,
      s2: toplamAlinan.s2 - kullanilan.s2,
    };
    return {
      s10: { maliyet_kalan: kalan.s10 * ortMaliyet.s10 },
      s5: { maliyet_kalan: kalan.s5 * ortMaliyet.s5 },
      s2: { maliyet_kalan: kalan.s2 * ortMaliyet.s2 },
    };
  }
  const detayliStokMaliyet = hesaplaDetayliStokDegeri(tinPurchases || [], transactions);
  const detayliBidonStokMaliyet = hesaplaDetayliBidonStokDegeri(plasticPurchases || [], transactions);
  const toplamTenekeKalanMaliyet = Object.values(detayliStokMaliyet).reduce((sum, v) => sum + (v.maliyet_kalan || 0), 0);
  const toplamBidonKalanMaliyet = Object.values(detayliBidonStokMaliyet).reduce((sum, v) => sum + (v.maliyet_kalan || 0), 0);
  // Yeni hesaplama kuralları:
  const totalFactoryExpenses = totalWorkerExpenses + totalFactoryOverhead + totalTinPurchaseCost + totalPlasticPurchaseCost;
  const totalFactoryIncome = totalBilledAmount + totalPomaceRevenues - totalPaymentLoss + toplamTenekeKalanMaliyet + toplamBidonKalanMaliyet;
  const netFactoryBalance = totalFactoryIncome - totalFactoryExpenses;
  return {
    totalFactoryIncome,
    totalFactoryExpenses,
    netFactoryBalance,
    totalWorkerExpenses,
    totalFactoryOverhead,
    totalPomaceRevenues,
    totalBilledAmount,
    totalPaymentLoss,
    toplamTenekeKalanMaliyet,
    toplamBidonKalanMaliyet,
    totalTinPurchaseCost,
    totalPlasticPurchaseCost
  };
}

// Yazdırılabilir Fiş Bileşeni
const PrintableReceipt = React.forwardRef(({ transactionData }, ref) => {
  const oliveCost = (Number(transactionData.oliveKg) || 0) * (Number(transactionData.pricePerKg) || 0);
  const tinCost = (Number(transactionData.tinCounts?.s16 || 0) * Number(transactionData.tinPrices?.s16 || 0)) + (Number(transactionData.tinCounts?.s10 || 0) * Number(transactionData.tinPrices?.s10 || 0)) + (Number(transactionData.tinCounts?.s5 || 0) * Number(transactionData.tinPrices?.s5 || 0));
  const plasticCost = (Number(transactionData.plasticCounts?.s10 || 0) * Number(transactionData.plasticPrices?.s10 || 0)) + (Number(transactionData.plasticCounts?.s5 || 0) * Number(transactionData.plasticPrices?.s5 || 0)) + (Number(transactionData.plasticCounts?.s2 || 0) * Number(transactionData.plasticPrices?.s2 || 0));
  const totalCost = oliveCost + tinCost + plasticCost;
  const remainingBalance = totalCost - (Number(transactionData.paymentReceived) || 0) - (Number(transactionData.paymentLoss) || 0);
  return (
    <div ref={ref} style={{ width: '100%', minHeight: '100%', fontFamily: 'Arial, sans-serif', padding: 24 }}>
      <div style={{ border: '2px dashed #333', borderRadius: 12, padding: 24, maxWidth: 520, margin: '0 auto', background: '#fff' }}>
        <h2 style={{ textAlign: 'center', fontWeight: 700, fontSize: 22, marginBottom: 8 }}>DÜLDÜL ZEYTİNYAĞI FABRİKASI</h2>
        <h3 style={{ textAlign: 'center', fontWeight: 600, fontSize: 18, marginBottom: 16 }}>İşlem Fişi / Makbuz</h3>
        <table style={{ width: '100%', marginBottom: 12, fontSize: 15 }}>
          <tbody>
            <tr><td><b>Müşteri:</b></td><td>{transactionData.customerName}</td></tr>
            <tr><td><b>Tarih:</b></td><td>{transactionData.date ? new Date(transactionData.date).toLocaleDateString() : ''}</td></tr>
            <tr><td><b>Açıklama:</b></td><td>{transactionData.description ? `${transactionData.description} (${formatNumber(transactionData.oliveKg)} kg zeytin)` : `${formatNumber(transactionData.oliveKg)} kg zeytin`}</td></tr>
          </tbody>
        </table>
        <hr style={{ margin: '12px 0' }} />
        <table style={{ width: '100%', fontSize: 15, marginBottom: 12 }}>
          <tbody>
            <tr><td>Zeytin (kg):</td><td>{transactionData.oliveKg}</td></tr>
            <tr><td>Çıkan Yağ (L):</td><td>{transactionData.oilLitre}</td></tr>
            <tr><td>Kg Başına Ücret (₺):</td><td>{transactionData.pricePerKg}</td></tr>
            <tr><td>Yağ Oranı:</td><td>{(Number(transactionData.oliveKg) > 0 && Number(transactionData.oilLitre) > 0) ? (Number(transactionData.oliveKg) / Number(transactionData.oilLitre)).toFixed(2) : '-'}</td></tr>
            <tr><td>Teneke (16/10/5):</td><td>{transactionData.tinCounts?.s16 || 0} / {transactionData.tinCounts?.s10 || 0} / {transactionData.tinCounts?.s5 || 0}</td></tr>
            <tr><td>Bidon (10/5/2):</td><td>{transactionData.plasticCounts?.s10 || 0} / {transactionData.plasticCounts?.s5 || 0} / {transactionData.plasticCounts?.s2 || 0}</td></tr>
          </tbody>
        </table>
        <hr style={{ margin: '12px 0' }} />
        <table style={{ width: '100%', fontSize: 15, marginBottom: 12 }}>
          <tbody>
            <tr><td>Zeytin Sıkım Ücreti:</td><td>{oliveCost.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺</td></tr>
            <tr><td>Teneke Fiyatı:</td><td>{tinCost.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺</td></tr>
            <tr><td>Bidon Fiyatı:</td><td>{plasticCost.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺</td></tr>
            <tr><td><b>Genel Toplam:</b></td><td><b>{totalCost.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺</b></td></tr>
            <tr><td>Alınan Ödeme:</td><td>{(Number(transactionData.paymentReceived) || 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺</td></tr>
            <tr><td><b>Kalan Bakiye:</b></td><td><b>{remainingBalance.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺</b></td></tr>
          </tbody>
        </table>
        <hr style={{ margin: '12px 0' }} />
      </div>
    </div>
  );
});

const BackupPage = ({ customers, transactions, workerExpenses, factoryOverhead, pomaceRevenues, tinPurchases, plasticPurchases, oilPurchases, oilSales }) => {
  // Fabrika özetini hesapla
  const totalOlive = transactions.reduce((sum, t) => sum + Number(t.oliveKg || 0), 0);
  const totalProducedOil = transactions.reduce((sum, t) => sum + Number(t.oilLitre || 0), 0);
  const totalBilledAmount = transactions.reduce((sum, t) => sum + Number(t.totalCost || 0), 0);
  const totalReceivedPayment = transactions.reduce((sum, t) => sum + Number(t.paymentReceived || 0), 0);
  const totalPaymentLoss = transactions.reduce((sum, t) => sum + Number(t.paymentLoss || 0), 0);
  const pendingPayments = totalBilledAmount - totalReceivedPayment - totalPaymentLoss;

  const totalFactoryWorkerExpenses = workerExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const totalFactoryOverheadExpenses = factoryOverhead.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const totalFactoryPomaceRevenues = pomaceRevenues.reduce((sum, revenue) => sum + Number(revenue.totalRevenue || 0), 0);
  
  const totalTinPurchaseCost = tinPurchases.reduce((sum, p) => sum + Number(p.totalCost || 0), 0);
  const totalPlasticPurchaseCost = plasticPurchases.reduce((sum, p) => sum + Number(p.totalCost || 0), 0);

  const totalFactoryExpenses = totalFactoryWorkerExpenses + totalFactoryOverheadExpenses + totalTinPurchaseCost + totalPlasticPurchaseCost;
  const totalFactoryIncome = totalBilledAmount + totalFactoryPomaceRevenues;
  const netFactoryBalance = totalFactoryIncome - totalFactoryExpenses;

  // Zeytinyağı Alım/Satım özetini hesapla
  const totalPurchasedTins = oilPurchases.reduce((sum, p) => sum + Number(p.tinCount || 0), 0);
  const totalSoldTins = oilSales.reduce((sum, s) => sum + Number(s.tinCount || 0), 0);
  const netOilStock = totalPurchasedTins - totalSoldTins;
  const totalOilPurchaseCost = oilPurchases.reduce((sum, p) => sum + Number(p.totalCost || 0), 0);
  const totalOilSaleRevenue = oilSales.reduce((sum, s) => sum + Number(s.totalRevenue || 0), 0);
  const oilTradingProfit = totalOilSaleRevenue - totalOilPurchaseCost;
  
  const overallAvgRatio = totalOlive > 0 && totalProducedOil > 0 ? (totalOlive / totalProducedOil).toFixed(2) : 'N/A';

  const handleDownloadTxt = async () => {
    try {
      const allData = await readData();

      // Fabrika Genel Özeti'ni hesapla
      const totalOlive = allData.transactions.reduce((sum, t) => sum + Number(t.oliveKg || 0), 0);
      const totalProducedOil = allData.transactions.reduce((sum, t) => sum + Number(t.oilLitre || 0), 0);
      const totalBilledAmount = allData.transactions.reduce((sum, t) => sum + Number(t.totalCost || 0), 0);
      const totalReceivedPayment = allData.transactions.reduce((sum, t) => sum + Number(t.paymentReceived || 0), 0);
      const totalPaymentLoss = allData.transactions.reduce((sum, t) => sum + Number(t.paymentLoss || 0), 0);
      const pendingPayments = totalBilledAmount - totalReceivedPayment - totalPaymentLoss;

      const totalFactoryWorkerExpenses = allData.workerExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
      const totalFactoryOverheadExpenses = allData.factoryOverhead.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
      const totalFactoryPomaceRevenues = allData.pomaceRevenues.reduce((sum, revenue) => sum + Number(revenue.totalRevenue || 0), 0);
      const totalTinPurchaseCost = allData.tinPurchases.reduce((sum, p) => sum + Number(p.totalCost || 0), 0);
      const totalPlasticPurchaseCost = allData.plasticPurchases.reduce((sum, p) => sum + Number(p.totalCost || 0), 0);

      const totalFactoryExpenses = totalFactoryWorkerExpenses + totalFactoryOverheadExpenses + totalTinPurchaseCost + totalPlasticPurchaseCost;
      const totalFactoryIncome = (totalBilledAmount - totalPaymentLoss) + totalFactoryPomaceRevenues; // Updated total income calculation
      const netFactoryBalance = totalFactoryIncome - totalFactoryExpenses;
      const overallAvgRatio = totalOlive > 0 && totalProducedOil > 0 ? (totalOlive / totalProducedOil).toFixed(2) : 'N/A';
      
      // Zeytinyağı Alım/Satım Özeti
      const totalPurchasedTins = allData.oilPurchases.reduce((sum, p) => sum + Number(p.tinCount || 0), 0);
      const totalSoldTins = allData.oilSales.reduce((sum, s) => sum + Number(s.tinCount || 0), 0);
      const netOilStock = totalPurchasedTins - totalSoldTins;
      const totalOilPurchaseCost = allData.oilPurchases.reduce((sum, p) => sum + Number(p.totalCost || 0), 0);
      const totalOilSaleRevenue = allData.oilSales.reduce((sum, s) => sum + Number(s.totalRevenue || 0), 0);
      const oilTradingProfit = totalOilSaleRevenue - totalOilPurchaseCost;
      

      // --- Kalan Teneke ve Bidon Stok Değerlerini Hesapla ---
      function hesaplaDetayliStokDegeri(tinPurchases, transactions) {
        let toplamAlinan = { s16: 0, s10: 0, s5: 0 };
        let toplamMaliyet = { s16: 0, s10: 0, s5: 0 };
        tinPurchases.forEach(p => {
          toplamAlinan.s16 += Number(p.s16 || 0);
          toplamAlinan.s10 += Number(p.s10 || 0);
          toplamAlinan.s5 += Number(p.s5 || 0);
          toplamMaliyet.s16 += (Number(p.s16 || 0) * Number(p.tinPrice || 0));
          toplamMaliyet.s10 += (Number(p.s10 || 0) * Number(p.tinPrice || 0));
          toplamMaliyet.s5 += (Number(p.s5 || 0) * Number(p.tinPrice || 0));
        });
        const ortMaliyet = {
          s16: toplamAlinan.s16 > 0 ? toplamMaliyet.s16 / toplamAlinan.s16 : 0,
          s10: toplamAlinan.s10 > 0 ? toplamMaliyet.s10 / toplamAlinan.s10 : 0,
          s5: toplamAlinan.s5 > 0 ? toplamMaliyet.s5 / toplamAlinan.s5 : 0,
        };
        let kullanilan = { s16: 0, s10: 0, s5: 0 };
        transactions.forEach(t => {
          kullanilan.s16 += Number(t.tinCounts?.s16 || 0);
          kullanilan.s10 += Number(t.tinCounts?.s10 || 0);
          kullanilan.s5 += Number(t.tinCounts?.s5 || 0);
        });
        let kalan = {
          s16: toplamAlinan.s16 - kullanilan.s16,
          s10: toplamAlinan.s10 - kullanilan.s10,
          s5: toplamAlinan.s5 - kullanilan.s5,
        };
        return {
          s16: { maliyet_kalan: kalan.s16 * ortMaliyet.s16 },
          s10: { maliyet_kalan: kalan.s10 * ortMaliyet.s10 },
          s5: { maliyet_kalan: kalan.s5 * ortMaliyet.s5 },
        };
      }
      function hesaplaDetayliBidonStokDegeri(plasticPurchases, transactions) {
        let toplamAlinan = { s10: 0, s5: 0, s2: 0 };
        let toplamMaliyet = { s10: 0, s5: 0, s2: 0 };
        plasticPurchases.forEach(p => {
          toplamAlinan.s10 += Number(p.s10 || 0);
          toplamAlinan.s5 += Number(p.s5 || 0);
          toplamAlinan.s2 += Number(p.s2 || 0);
          toplamMaliyet.s10 += (Number(p.s10 || 0) * Number(p.plasticPrice || 0));
          toplamMaliyet.s5 += (Number(p.s5 || 0) * Number(p.plasticPrice || 0));
          toplamMaliyet.s2 += (Number(p.s2 || 0) * Number(p.plasticPrice || 0));
        });
        const ortMaliyet = {
          s10: toplamAlinan.s10 > 0 ? toplamMaliyet.s10 / toplamAlinan.s10 : 0,
          s5: toplamAlinan.s5 > 0 ? toplamMaliyet.s5 / toplamAlinan.s5 : 0,
          s2: toplamAlinan.s2 > 0 ? toplamMaliyet.s2 / toplamAlinan.s2 : 0,
        };
        let kullanilan = { s10: 0, s5: 0, s2: 0 };
        transactions.forEach(t => {
          kullanilan.s10 += Number(t.plasticCounts?.s10 || 0);
          kullanilan.s5 += Number(t.plasticCounts?.s5 || 0);
          kullanilan.s2 += Number(t.plasticCounts?.s2 || 0);
        });
        let kalan = {
          s10: toplamAlinan.s10 - kullanilan.s10,
          s5: toplamAlinan.s5 - kullanilan.s5,
          s2: toplamAlinan.s2 - kullanilan.s2,
        };
        return {
          s10: { maliyet_kalan: kalan.s10 * ortMaliyet.s10 },
          s5: { maliyet_kalan: kalan.s5 * ortMaliyet.s5 },
          s2: { maliyet_kalan: kalan.s2 * ortMaliyet.s2 },
        };
      }
      const detayliStokMaliyet = hesaplaDetayliStokDegeri(allData.tinPurchases || [], allData.transactions || []);
      const detayliBidonStokMaliyet = hesaplaDetayliBidonStokDegeri(allData.plasticPurchases || [], allData.transactions || []);
      const toplamTenekeKalanMaliyet = Object.values(detayliStokMaliyet).reduce((sum, v) => sum + (v.maliyet_kalan || 0), 0);
      const toplamBidonKalanMaliyet = Object.values(detayliBidonStokMaliyet).reduce((sum, v) => sum + (v.maliyet_kalan || 0), 0);

      let fileContent = `DÜLDÜL ZEYTİNYAĞI FABRİKASI - YEDEK DOSYASI\n`;
      fileContent += `Yedekleme Tarihi: ${new Date().toLocaleString('tr-TR')}\n`;
      fileContent += `==================================================\n\n`;

      // Fabrika Genel Özeti
      const toplamGelirKart = (totalBilledAmount - totalPaymentLoss) + totalFactoryPomaceRevenues + toplamTenekeKalanMaliyet + toplamBidonKalanMaliyet;
      fileContent += `==================================================\n`;
      fileContent += `--- FABRİKA GENEL ÖZETİ ---\n`;
      fileContent += `Toplam Gelir: ${formatNumber(toplamGelirKart, '₺')}\n`;
      fileContent += `Toplam Gider: ${formatNumber(totalFactoryExpenses, '₺')}\n`;
      fileContent += `Net Kâr/Zarar: ${formatNumber(toplamGelirKart - totalFactoryExpenses, '₺')}\n`;
      fileContent += `Kalan Teneke Stok Değeri: ${formatNumber(toplamTenekeKalanMaliyet, '₺')}\n`;
      fileContent += `Kalan Bidon Stok Değeri: ${formatNumber(toplamBidonKalanMaliyet, '₺')}\n`;
      fileContent += `\n`;

      // --- ZEYTİN ÇEKİM ÜCRETLERİ ---
      // Ayrıntılı hasılat kalemlerini hesapla
      const oliveIncome = allData.transactions.reduce((sum, t) => sum + (Number(t.oliveKg || 0) * Number(t.pricePerKg || 0)), 0);
      const tinIncome = allData.transactions.reduce((sum, t) =>
        sum + (Number(t.tinCounts?.s16 || 0) * Number(t.tinPrices?.s16 || 0))
            + (Number(t.tinCounts?.s10 || 0) * Number(t.tinPrices?.s10 || 0))
            + (Number(t.tinCounts?.s5 || 0) * Number(t.tinPrices?.s5 || 0)), 0);
      const plasticIncome = allData.transactions.reduce((sum, t) =>
        sum + (Number(t.plasticCounts?.s10 || 0) * Number(t.plasticPrices?.s10 || 0))
            + (Number(t.plasticCounts?.s5 || 0) * Number(t.plasticPrices?.s5 || 0))
            + (Number(t.plasticCounts?.s2 || 0) * Number(t.plasticPrices?.s2 || 0)), 0);
      const toplamHasılat = oliveIncome + tinIncome + plasticIncome;
      fileContent += `==================================================\n`;
      fileContent += `--- ZEYTİN ÇEKİM ÜCRETLERİ ---\n`;
      fileContent += `Zeytin Sıkımı Hasılatı: ${formatNumber(oliveIncome, '₺')}\n`;
      fileContent += `Teneke Satışı Hasılatı: ${formatNumber(tinIncome, '₺')}\n`;
      fileContent += `Bidon Satışı Hasılatı: ${formatNumber(plasticIncome, '₺')}\n`;
      fileContent += `Toplam Hasılat: ${formatNumber(toplamHasılat - totalPaymentLoss, '₺')}\n`;
      fileContent += `Toplam Alınan Ödeme: ${formatNumber(totalReceivedPayment, '₺')}\n`;
      fileContent += `Bekleyen Ödemeler: ${formatNumber(pendingPayments, '₺')}\n`;
      fileContent += `Ödeme Firesi: ${formatNumber(totalPaymentLoss, '₺')}\n`;
      fileContent += `\n`;

      // --- ZEYTİNYAĞI ALIM/SATIM ÖZETİ ---
      const toplamOilPurchaseCost = allData.oilPurchases.reduce((sum, p) => sum + Number(p.totalCost || 0), 0);
      const toplamOilSaleRevenue = allData.oilSales.reduce((sum, s) => sum + Number(s.totalRevenue || 0), 0);
      const toplamAlinanOilTins = allData.oilPurchases.reduce((sum, p) => sum + Number(p.tinCount || 0), 0);
      const toplamSatilanOilTins = allData.oilSales.reduce((sum, s) => sum + Number(s.tinCount || 0), 0);
      const kalanOilTins = toplamAlinanOilTins - toplamSatilanOilTins;
      const netOilProfit = toplamOilSaleRevenue - toplamOilPurchaseCost;
      fileContent += `==================================================\n`;
      fileContent += `--- ZEYTİNYAĞI ALIM/SATIM ÖZETİ ---\n`;
      fileContent += `Toplam Alım Maliyeti: ${formatNumber(toplamOilPurchaseCost, '₺')}\n`;
      fileContent += `Toplam Satış Geliri: ${formatNumber(toplamOilSaleRevenue, '₺')}\n`;
      fileContent += `Kalan Net Teneke Stoğu: ${formatNumber(kalanOilTins, 'adet')}\n`;
      fileContent += `Net Kâr/Zarar: ${formatNumber(netOilProfit, '₺')}\n`;
      fileContent += `\n`;

      // Zeytinyağı alımları ve satışları zeytinyağı alım/satım özetinin hemen altında
      fileContent += `==================================================\n`;
      fileContent += `--- ZEYTİNYAĞI ALIMLARI (${allData.oilPurchases.length} adet) ---\n`;
      allData.oilPurchases.forEach(e => {
          fileContent += `Tarih: ${new Date(e.date).toLocaleDateString('tr-TR')}, Firma: ${e.supplierName}, Teneke Sayısı: ${e.tinCount}, Teneke Fiyatı: ${formatNumber(e.tinPrice, '₺')}, Toplam Maliyet: ${formatNumber(e.totalCost, '₺')}\n`;
      });
      fileContent += `\n`;
      fileContent += `==================================================\n`;
      fileContent += `--- ZEYTİNYAĞI SATIŞLARI (${allData.oilSales.length} adet) ---\n`;
      allData.oilSales.forEach(e => {
          fileContent += `Tarih: ${new Date(e.date).toLocaleDateString('tr-TR')}, Müşteri: ${e.customerName}, Teneke Sayısı: ${e.tinCount}, Teneke Fiyatı: ${formatNumber(e.tinPrice, '₺')}, Toplam Gelir: ${formatNumber(e.totalRevenue, '₺')}\n`;
      });
      fileContent += `\n`;


      // Giderler
      fileContent += `==================================================\n`;
      fileContent += `--- İŞÇİ GİDERLERİ (${allData.workerExpenses.length} adet) ---\n`;
      allData.workerExpenses.forEach(e => {
          fileContent += `Tarih: ${new Date(e.date).toLocaleDateString('tr-TR')}, İsim: ${e.workerName}, Çalıştığı Gün: ${e.daysWorked}, Tutar: ${formatNumber(e.amount, '₺')}, Açıklama: ${e.description}\n`;
      });
      fileContent += `\n`;
      fileContent += `==================================================\n`;
      fileContent += `--- MUHTELİF GİDERLER (${allData.factoryOverhead.length} adet) ---\n`;
      allData.factoryOverhead.forEach(e => {
          fileContent += `Tarih: ${new Date(e.date).toLocaleDateString('tr-TR')}, Açıklama: ${e.description}, Tutar: ${formatNumber(e.amount, '₺')}\n`;
      });
      fileContent += `\n`;
      fileContent += `==================================================\n`;
      fileContent += `--- TENEKE ALIMLARI (${allData.tinPurchases.length} adet) ---\n`;
      allData.tinPurchases.forEach(e => {
          fileContent += `Tarih: ${new Date(e.date).toLocaleDateString('tr-TR')}, 16'lık: ${e.s16 || 0}, 10'luk: ${e.s10 || 0}, 5'lik: ${e.s5 || 0}, Birim Fiyat: ${formatNumber(e.tinPrice, '₺')}, Toplam Maliyet: ${formatNumber(e.totalCost, '₺')}, Açıklama: ${e.description}\n`;
      });
      fileContent += `\n`;
      fileContent += `==================================================\n`;
      fileContent += `--- BİDON ALIMLARI (${allData.plasticPurchases.length} adet) ---\n`;
      allData.plasticPurchases.forEach(e => {
          fileContent += `Tarih: ${new Date(e.date).toLocaleDateString('tr-TR')}, 10'luk: ${e.s10 || 0}, 5'lik: ${e.s5 || 0}, 2'lik: ${e.s2 || 0}, Birim Fiyat: ${formatNumber(e.plasticPrice, '₺')}, Toplam Maliyet: ${formatNumber(e.totalCost, '₺')}, Açıklama: ${e.description}\n`;
      });
      fileContent += `\n`;
      fileContent += `==================================================\n`;
      fileContent += `--- PİRİNA GELİRLERİ (${allData.pomaceRevenues.length} adet) ---\n`;
      allData.pomaceRevenues.forEach(e => {
          fileContent += `Tarih: ${new Date(e.date).toLocaleDateString('tr-TR')}, Açıklama: ${e.description}, Tır Sayısı: ${e.truckCount}, Yük: ${e.loadKg} kg, Kg Fiyatı: ${e.pricePerKg} ₺, Toplam Gelir: ${formatNumber(e.totalRevenue, '₺')}\n`;
      });
      fileContent += `\n`;



      // Kalan teneke ve bidon hesaplama fonksiyonları
      function kalanTenekeAdetleri(tinPurchases, transactions) {
        let alinan = { s16: 0, s10: 0, s5: 0 };
        let kullanilan = { s16: 0, s10: 0, s5: 0 };
        tinPurchases.forEach(p => {
          alinan.s16 += Number(p.s16 || 0);
          alinan.s10 += Number(p.s10 || 0);
          alinan.s5 += Number(p.s5 || 0);
        });
        transactions.forEach(t => {
          kullanilan.s16 += Number(t.tinCounts?.s16 || 0);
          kullanilan.s10 += Number(t.tinCounts?.s10 || 0);
          kullanilan.s5 += Number(t.tinCounts?.s5 || 0);
        });
        return {
          s16: alinan.s16 - kullanilan.s16,
          s10: alinan.s10 - kullanilan.s10,
          s5:  alinan.s5  - kullanilan.s5
        };
      }
      function kalanBidonAdetleri(plasticPurchases, transactions) {
        let alinan = { s10: 0, s5: 0, s2: 0 };
        let kullanilan = { s10: 0, s5: 0, s2: 0 };
        plasticPurchases.forEach(p => {
          alinan.s10 += Number(p.s10 || 0);
          alinan.s5 += Number(p.s5 || 0);
          alinan.s2 += Number(p.s2 || 0);
        });
        transactions.forEach(t => {
          kullanilan.s10 += Number(t.plasticCounts?.s10 || 0);
          kullanilan.s5 += Number(t.plasticCounts?.s5 || 0);
          kullanilan.s2 += Number(t.plasticCounts?.s2 || 0);
        });
        return {
          s10: alinan.s10 - kullanilan.s10,
          s5:  alinan.s5  - kullanilan.s5,
          s2:  alinan.s2  - kullanilan.s2
        };
      }

      // Müşteri Kayıtları (EN ALTTA)
      fileContent += `==================================================\n`;
      fileContent += `--- TENEKE/BİDON STOKLARI ---\n`;
      const kalanTeneke = kalanTenekeAdetleri(allData.tinPurchases || [], allData.transactions || []);
      const kalanBidon = kalanBidonAdetleri(allData.plasticPurchases || [], allData.transactions || []);
      fileContent += `Kalan Teneke Stokları:\n`;
      fileContent += `  16'lık: ${kalanTeneke.s16} adet\n`;
      fileContent += `  10'luk: ${kalanTeneke.s10} adet\n`;
      fileContent += `  5'lik: ${kalanTeneke.s5} adet\n`;
      fileContent += `Kalan Bidon Stokları:\n`;
      fileContent += `  10'luk: ${kalanBidon.s10} adet\n`;
      fileContent += `  5'lik: ${kalanBidon.s5} adet\n`;
      fileContent += `  2'lik: ${kalanBidon.s2} adet\n`;
      fileContent += `\n`;

      // Müşteri Kayıtları (EN ALTTA)
      fileContent += `==================================================\n`;
      fileContent += `--- MÜŞTERİ KAYITLARI ---\n`;
      customers.forEach(c => {
        const customerTransactions = allData.transactions.filter(t => t.customerId === c.id);
        fileContent += `\n*** Müşteri Adı: ${c.name} ***\n`;
        fileContent += `  > İşlem Geçmişi:\n`;
        if (customerTransactions.length > 0) {
          customerTransactions.forEach(t => {
            const description = t.description ? `${t.description} (${formatNumber(t.oliveKg)} kg zeytin)` : `${formatNumber(t.oliveKg)} kg zeytin`;
            const remaining = (t.totalCost || 0) - (t.paymentReceived || 0) - (t.paymentLoss || 0);
            fileContent += `    - Tarih: ${new Date(t.date).toLocaleDateString()}, Açıklama: ${description}, Tutar: ${formatNumber(t.totalCost, '₺')}, Alınan: ${formatNumber(t.paymentReceived, '₺')}, Kalan: ${formatNumber(remaining, '₺')}\n`;
          });
        } else {
          fileContent += `    (Bu müşteriye ait işlem bulunmamaktadır.)\n`;
        }
      });
      fileContent += `\n`;

      const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `duldule_yedek_${new Date().toISOString().split('T')[0]}.txt`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error("Yedekleme dosyası oluşturulurken hata oluştu:", err);
      alert("Yedekleme dosyası oluşturulurken bir hata oluştu. Lütfen konsolu kontrol edin.");
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Veri Yedekleme</h1>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Metin Dosyası (.txt) Olarak İndir</h2>
        <p className="text-gray-600 mb-6">
          Programdaki tüm verileri içeren, kolayca okunabilir bir yedek dosyası oluşturur ve indirir.
        </p>
        <button 
          onClick={handleDownloadTxt} 
          className="flex items-center justify-center space-x-2 px-6 py-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 shadow-md transition-colors w-full md:w-auto"
        >
          <Download className="w-5 h-5" />
          <span>Yedek Dosyasını İndir (.txt)</span>
        </button>
      </div>
    </div>
  );
};

let ipcRenderer = null;
try {
  if (typeof window !== 'undefined' && window.require) {
    ipcRenderer = window.require('electron').ipcRenderer;
  }
} catch (e) { ipcRenderer = null; }

export default App;
