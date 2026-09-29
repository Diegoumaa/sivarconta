import React, { createContext, useContext, useState, useEffect } from 'react';
import { Company, Product, Client, InvoiceDocument, PurchaseDocument, DteType } from '../types';
import { INITIAL_COMPANIES, INITIAL_PRODUCTS, INITIAL_CLIENTS, INITIAL_INVOICES, INITIAL_PURCHASES } from '../data/mockData';
import { generateUUID, generateControlNumber, generateReceptionStamp, getMhQrUrl } from '../utils/dteUtils';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import confetti from 'canvas-confetti';

interface AppContextType {
  companies: Company[];
  currentCompany: Company;
  currentCompanyId: string;
  setCurrentCompanyId: (id: string) => void;
  products: Product[];
  clients: Client[];
  invoices: InvoiceDocument[];
  purchases: PurchaseDocument[];
  currentView: string;
  setCurrentView: (view: string) => void;
  selectedDteTypeForNew: DteType;
  setSelectedDteTypeForNew: (dte: DteType) => void;
  startNewInvoiceWithDte: (dte: DteType) => void;
  activeDtePreview: InvoiceDocument | null;
  setActiveDtePreview: (doc: InvoiceDocument | null) => void;
  createInvoice: (data: any) => Promise<InvoiceDocument>;
  addProduct: (product: Omit<Product, 'id' | 'companyId'>) => Promise<void>;
  addClient: (client: Omit<Client, 'id' | 'companyId'>) => Promise<void>;
  addPurchase: (purchase: Omit<PurchaseDocument, 'id' | 'companyId'>) => Promise<void>;
  filteredProducts: Product[];
  filteredClients: Client[];
  filteredInvoices: InvoiceDocument[];
  filteredPurchases: PurchaseDocument[];
  isCloudSyncActive: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [companies, setCompanies] = useState<Company[]>(() => {
    const saved = localStorage.getItem('sivarconta_companies');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0 && parsed[0].id === 'comp-1') {
          return INITIAL_COMPANIES;
        }
        return parsed;
      } catch (e) {
        return INITIAL_COMPANIES;
      }
    }
    return INITIAL_COMPANIES;
  });

  const [currentCompanyId, setCurrentCompanyId] = useState<string>(() => {
    const firstId = companies[0]?.id;
    return (firstId && firstId !== 'comp-1') ? firstId : 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  });

  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('sivarconta_products');
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });

  const [clients, setClients] = useState<Client[]>(() => {
    const saved = localStorage.getItem('sivarconta_clients');
    return saved ? JSON.parse(saved) : INITIAL_CLIENTS;
  });

  const [invoices, setInvoices] = useState<InvoiceDocument[]>(() => {
    const saved = localStorage.getItem('sivarconta_invoices');
    return saved ? JSON.parse(saved) : INITIAL_INVOICES;
  });

  const [purchases, setPurchases] = useState<PurchaseDocument[]>(() => {
    const saved = localStorage.getItem('sivarconta_purchases');
    return saved ? JSON.parse(saved) : INITIAL_PURCHASES;
  });

  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [selectedDteTypeForNew, setSelectedDteTypeForNew] = useState<DteType>('01');
  const [activeDtePreview, setActiveDtePreview] = useState<InvoiceDocument | null>(null);

  // Sync from Supabase on mount if configured
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const loadCloudData = async () => {
      try {
        const client = supabase;
        if (!client) return;
        // 1. Fetch Companies
        const { data: cloudCompanies } = await client.from('companies').select('*');
        if (cloudCompanies && cloudCompanies.length > 0) {
          const mappedCompanies: Company[] = cloudCompanies.map(c => ({
            id: c.id,
            name: c.name,
            tradeName: c.trade_name || c.name,
            nit: c.nit,
            nrc: c.nrc,
            economicActivityCode: c.economic_activity_code,
            economicActivity: c.economic_activity_desc,
            taxpayerType: c.is_gran_contribuyente ? 'GRAN_CONTRIBUYENTE' : 'PEQUENO',
            phone: c.phone,
            email: c.email,
            address: c.address,
            department: 'San Salvador',
            municipality: 'San Salvador Centro',
            establishmentCode: c.establishment_code || 'M001',
            posCode: c.pos_code || 'P001',
            mhEnvironment: c.mh_environment,
            mhUser: c.nit.replace(/-/g, '')
          }));
          setCompanies(mappedCompanies);
          setCurrentCompanyId(mappedCompanies[0].id);
        }

        // 2. Fetch Clients
        const { data: cloudClients } = await client.from('clients').select('*');
        if (cloudClients && cloudClients.length > 0) {
          const mappedClients: Client[] = cloudClients.map(c => ({
            id: c.id,
            companyId: c.company_id,
            name: c.name,
            docType: c.doc_type === 'NIT' ? 'NIT' : 'DUI',
            docNumber: c.doc_number,
            nrc: c.nrc || undefined,
            economicActivity: c.economic_activity || undefined,
            taxpayerType: c.is_gran_contribuyente ? 'GRAN_CONTRIBUYENTE' : 'PEQUENO',
            email: c.email,
            phone: c.phone,
            address: c.address,
            department: c.department || 'San Salvador',
            municipality: c.municipality || 'San Salvador Centro'
          }));
          setClients(mappedClients);
        }

        // 3. Fetch Products
        const { data: cloudProducts } = await client.from('products').select('*');
        if (cloudProducts && cloudProducts.length > 0) {
          const mappedProducts: Product[] = cloudProducts.map(p => ({
            id: p.id,
            companyId: p.company_id,
            code: p.code,
            name: p.name,
            description: p.description || '',
            unitPrice: Number(p.price),
            taxType: p.tax_type as any,
            unitOfMeasure: p.unit_of_measure,
            category: 'General',
            stock: Number(p.stock)
          }));
          setProducts(mappedProducts);
        }
      } catch (err) {
        console.error('Error loading data from Supabase:', err);
      }
    };

    loadCloudData();
  }, []);

  // Sync to localStorage as local backup
  useEffect(() => {
    localStorage.setItem('sivarconta_companies', JSON.stringify(companies));
  }, [companies]);

  useEffect(() => {
    localStorage.setItem('sivarconta_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('sivarconta_clients', JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem('sivarconta_invoices', JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    localStorage.setItem('sivarconta_purchases', JSON.stringify(purchases));
  }, [purchases]);

  const currentCompany = companies.find(c => c.id === currentCompanyId) || companies[0];

  const filteredProducts = products.filter(p => p.companyId === currentCompanyId);
  const filteredClients = clients.filter(c => c.companyId === currentCompanyId);
  const filteredInvoices = invoices.filter(i => i.companyId === currentCompanyId);
  const filteredPurchases = purchases.filter(p => p.companyId === currentCompanyId);

  const startNewInvoiceWithDte = (dte: DteType) => {
    setSelectedDteTypeForNew(dte);
    setCurrentView('new-invoice');
  };

  const getEffectiveCompanyId = () => {
    return (currentCompanyId && currentCompanyId.length === 36 && currentCompanyId !== 'comp-1')
      ? currentCompanyId
      : 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  };

  const addProduct = async (productData: Omit<Product, 'id' | 'companyId'>) => {
    const effCompanyId = getEffectiveCompanyId();
    const newProd: Product = {
      ...productData,
      id: `prod-${Date.now()}`,
      companyId: effCompanyId
    };

    setProducts(prev => [newProd, ...prev]);

    // Push to Supabase if configured
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('products').insert([{
          company_id: effCompanyId,
          code: productData.code,
          name: productData.name,
          description: productData.description,
          price: productData.unitPrice,
          tax_type: productData.taxType,
          unit_of_measure: productData.unitOfMeasure,
          stock: productData.stock || 0
        }]);
      } catch (e) {
        console.error('Error saving product to Supabase:', e);
      }
    }
  };

  const addClient = async (clientData: Omit<Client, 'id' | 'companyId'>) => {
    const effCompanyId = getEffectiveCompanyId();
    const newCli: Client = {
      ...clientData,
      id: `cli-${Date.now()}`,
      companyId: effCompanyId
    };

    setClients(prev => [newCli, ...prev]);

    // Push to Supabase if configured
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('clients').insert([{
          company_id: effCompanyId,
          name: clientData.name,
          doc_type: clientData.docType,
          doc_number: clientData.docNumber,
          nrc: clientData.nrc || null,
          economic_activity: clientData.economicActivity || null,
          is_gran_contribuyente: clientData.taxpayerType === 'GRAN_CONTRIBUYENTE',
          email: clientData.email,
          phone: clientData.phone,
          address: clientData.address,
          department: clientData.department,
          municipality: clientData.municipality
        }]);
      } catch (e) {
        console.error('Error saving client to Supabase:', e);
      }
    }
  };

  const addPurchase = async (purchaseData: Omit<PurchaseDocument, 'id' | 'companyId'>) => {
    const effCompanyId = getEffectiveCompanyId();
    const newPur: PurchaseDocument = {
      ...purchaseData,
      id: `pur-${Date.now()}`,
      companyId: effCompanyId
    };

    setPurchases(prev => [newPur, ...prev]);

    // Push to Supabase if configured
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('purchases').insert([{
          company_id: effCompanyId,
          dte_type: purchaseData.docType === 'CCF' ? '03' : '01',
          control_number: purchaseData.docNumber,
          generation_code: purchaseData.generationCode || generateUUID(),
          supplier_name: purchaseData.supplierName,
          supplier_nit: purchaseData.supplierNit,
          supplier_nrc: purchaseData.supplierNrc || '',
          date: purchaseData.emissionDate,
          subtotal_gravado: purchaseData.purchasesGravadas,
          subtotal_exento: purchaseData.purchasesExentas,
          iva13: purchaseData.creditoFiscal,
          retencion1: purchaseData.retencion1,
          total: purchaseData.totalPagar
        }]);
      } catch (e) {
        console.error('Error saving purchase to Supabase:', e);
      }
    }
  };

  const createInvoice = async (invoicePayload: any): Promise<InvoiceDocument> => {
    const effCompanyId = getEffectiveCompanyId();
    const now = new Date();
    const emissionDate = now.toISOString().split('T')[0];
    const emissionTime = now.toTimeString().split(' ')[0];
    const generationCode = generateUUID();
    
    // Correlative for this DTE type
    const existingOfSameType = filteredInvoices.filter(i => i.dteType === invoicePayload.dteType);
    const correlative = existingOfSameType.length + 101;
    const controlNumber = generateControlNumber(
      invoicePayload.dteType,
      correlative,
      currentCompany.establishmentCode,
      currentCompany.posCode
    );

    const receptionStamp = generateReceptionStamp();
    const qrUrl = getMhQrUrl(generationCode, emissionDate, currentCompany.mhEnvironment);

    const newInvoice: InvoiceDocument = {
      ...invoicePayload,
      id: `inv-${Date.now()}`,
      companyId: effCompanyId,
      generationCode,
      controlNumber,
      emissionDate,
      emissionTime,
      establishmentCode: currentCompany.establishmentCode,
      posCode: currentCompany.posCode,
      status: 'PROCESADO_MH',
      mhReceptionStamp: receptionStamp,
      mhResponseDate: `${emissionDate} ${emissionTime}`,
      mhQrUrl: qrUrl
    };

    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e) {
      // ignore
    }

    setInvoices(prev => [newInvoice, ...prev]);

    // Push to Supabase if configured
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('invoices').insert([{
          company_id: effCompanyId,
          dte_type: newInvoice.dteType,
          control_number: newInvoice.controlNumber,
          generation_code: newInvoice.generationCode,
          client_name: newInvoice.clientName,
          client_doc_type: newInvoice.clientDocType,
          client_doc_number: newInvoice.clientDocNumber,
          client_nrc: newInvoice.clientNrc || null,
          client_email: newInvoice.clientEmail,
          client_phone: newInvoice.clientPhone || null,
          client_address: newInvoice.clientAddress,
          client_municipality: newInvoice.clientMunicipality,
          client_department: newInvoice.clientDepartment,
          emission_date: newInvoice.emissionDate,
          emission_time: newInvoice.emissionTime,
          condition: newInvoice.condition,
          credit_term_days: newInvoice.creditTermDays || 0,
          payment_method: newInvoice.paymentMethod,
          subtotal_gravado: newInvoice.subtotalGravado,
          subtotal_exento: newInvoice.subtotalExento,
          subtotal_no_sujeto: newInvoice.subtotalNoSujeto,
          descuento_total: newInvoice.descuentoTotal,
          iva13: newInvoice.iva13,
          retencion1: newInvoice.retencion1,
          percepcion1: newInvoice.percepcion1 || 0,
          retencion_renta10: newInvoice.retencionRenta10,
          total_pagar: newInvoice.totalPagar,
          total_letras: newInvoice.totalLetras,
          establishment_code: newInvoice.establishmentCode,
          pos_code: newInvoice.posCode,
          status: 'PROCESADO',
          mh_reception_stamp: newInvoice.mhReceptionStamp,
          observations: newInvoice.observations || null
        }]);
      } catch (e) {
        console.error('Error saving invoice to Supabase:', e);
      }
    }

    return newInvoice;
  };

  return (
    <AppContext.Provider
      value={{
        companies,
        currentCompany,
        currentCompanyId,
        setCurrentCompanyId,
        products,
        clients,
        invoices,
        purchases,
        currentView,
        setCurrentView,
        selectedDteTypeForNew,
        setSelectedDteTypeForNew,
        startNewInvoiceWithDte,
        activeDtePreview,
        setActiveDtePreview,
        createInvoice,
        addProduct,
        addClient,
        addPurchase,
        filteredProducts,
        filteredClients,
        filteredInvoices,
        filteredPurchases,
        isCloudSyncActive: isSupabaseConfigured
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
