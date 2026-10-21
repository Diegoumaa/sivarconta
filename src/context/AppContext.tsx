import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Company, Product, Client, InvoiceDocument, PurchaseDocument, DteType } from '../types';
import { INITIAL_COMPANIES, INITIAL_PRODUCTS, INITIAL_CLIENTS, INITIAL_INVOICES, INITIAL_PURCHASES } from '../data/mockData';
import { generateUUID, generateControlNumber } from '../utils/dteUtils';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { readBackup, writeBackup } from '../lib/localBackup';
import { toast } from 'sonner';

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
  addCompany: (company: Omit<Company, 'id'>) => Promise<Company>;
  addProduct: (product: Omit<Product, 'id' | 'companyId'>) => Promise<void>;
  addClient: (client: Omit<Client, 'id' | 'companyId'>) => Promise<void>;
  addPurchase: (purchase: Omit<PurchaseDocument, 'id' | 'companyId'>) => Promise<void>;
  filteredProducts: Product[];
  filteredClients: Client[];
  filteredInvoices: InvoiceDocument[];
  filteredPurchases: PurchaseDocument[];
  isCloudSyncActive: boolean;
  dataMode: 'cloud' | 'local-demo';
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const UNSELECTED_COMPANY: Company = {
  id: '', name: 'Seleccione una empresa', tradeName: 'Sin empresa disponible',
  nit: '', nrc: '', economicActivity: '', economicActivityCode: '', taxpayerType: 'OTRO',
  department: '', municipality: '', address: '', phone: '', email: '',
  mhEnvironment: 'PRUEBAS', mhUser: '', establishmentCode: 'M001', posCode: 'P001'
};

export const AppProvider: React.FC<{ children: React.ReactNode; demo?: boolean }> = ({ children, demo = false }) => {
  const useCloud = isSupabaseConfigured && !demo;
  const [companies, setCompanies] = useState<Company[]>(() =>
    useCloud ? [] : readBackup('sivarconta_companies', INITIAL_COMPANIES));

  const [currentCompanyId, setCurrentCompanyIdState] = useState<string>(() => {
    const firstId = companies[0]?.id;
    return firstId || '';
  });

  const [products, setProducts] = useState<Product[]>(() => {
    return useCloud ? [] : readBackup('sivarconta_products', INITIAL_PRODUCTS);
  });

  const [clients, setClients] = useState<Client[]>(() => {
    return useCloud ? [] : readBackup('sivarconta_clients', INITIAL_CLIENTS);
  });

  const [invoices, setInvoices] = useState<InvoiceDocument[]>(() => {
    return useCloud ? [] : readBackup('sivarconta_invoices', INITIAL_INVOICES);
  });

  const [purchases, setPurchases] = useState<PurchaseDocument[]>(() => {
    return useCloud ? [] : readBackup('sivarconta_purchases', INITIAL_PURCHASES);
  });

  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [selectedDteTypeForNew, setSelectedDteTypeForNew] = useState<DteType>('01');
  const [activeDtePreview, setActiveDtePreview] = useState<InvoiceDocument | null>(null);
  const [isCloudSyncActive, setIsCloudSyncActive] = useState(false);
  const reservedCorrelatives = useRef(new Map<string, number>());

  const setCurrentCompanyId = (id: string) => {
    if (!companies.some(company => company.id === id)) return;
    setCurrentCompanyIdState(id);
    setActiveDtePreview(null);
    setCurrentView('dashboard');
  };

  // Sync from Supabase on mount if configured
  useEffect(() => {
    if (!useCloud || !supabase) return;

    const loadCloudData = async () => {
      try {
        const client = supabase;
        if (!client) return;
        // Supabase resolves HTTP/SQL failures with { error }; it does not throw.
        // Validate the complete snapshot before replacing any displayed data.
        const results = await Promise.all([
          client.from('companies').select('*'),
          client.from('clients').select('*'),
          client.from('products').select('*'),
          client.from('invoices').select('*, invoice_items(*)').order('created_at', { ascending: false }),
          client.from('purchases').select('*').order('created_at', { ascending: false })
        ]);
        const failed = results.find(result => result.error);
        if (failed?.error) throw failed.error;
        // 1. Fetch Companies
        const cloudCompanies = results[0].data || [];
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
          setCurrentCompanyIdState(mappedCompanies[0].id);
        } else {
          setCompanies([]);
          setCurrentCompanyIdState('');
        }

        // 2. Fetch Clients
        const cloudClients = results[1].data || [];
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
        } else setClients([]);

        // 3. Fetch Products
        const cloudProducts = results[2].data || [];
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
        } else setProducts([]);

        // 4. Fetch Invoices
        const cloudInvoices = results[3].data || [];
        if (cloudInvoices && cloudInvoices.length > 0) {
          const mappedInvoices: InvoiceDocument[] = cloudInvoices.map(inv => ({
            id: inv.id,
            companyId: inv.company_id,
            dteType: inv.dte_type as any,
            generationCode: inv.generation_code,
            controlNumber: inv.control_number,
            emissionDate: inv.emission_date,
            emissionTime: inv.emission_time,
            establishmentCode: inv.establishment_code || 'M001',
            posCode: inv.pos_code || 'P001',
            status: inv.status === 'PROCESADO' ? 'PROCESADO_MH'
              : inv.status === 'RECHAZADO' ? 'RECHAZADO_MH'
              : inv.status === 'ANULADO' ? 'INVALIDADO'
              : inv.status === 'TRANSMITIDO' ? 'TRANSMITIENDO' : 'BORRADOR',
            clientId: inv.client_id || 'cli-generic',
            clientName: inv.client_name,
            clientDocType: inv.client_doc_type,
            clientDocNumber: inv.client_doc_number,
            clientNrc: inv.client_nrc || undefined,
            clientEmail: inv.client_email || '',
            clientPhone: inv.client_phone || undefined,
            clientAddress: inv.client_address || '',
            clientMunicipality: inv.client_municipality || 'San Salvador',
            clientDepartment: inv.client_department || 'San Salvador',
            paymentMethod: inv.payment_method || '01',
            condition: inv.condition as any,
            creditTermDays: inv.credit_term_days || undefined,
            items: (inv.invoice_items || []).sort((a: any, b: any) => a.num_item - b.num_item).map((item: any) => ({
              id: item.id,
              productId: item.product_id || undefined,
              code: item.code || '',
              description: item.description,
              quantity: Number(item.quantity),
              unitPrice: Number(item.unit_price),
              discount: Number(item.discount),
              taxType: item.tax_type,
              unitOfMeasure: item.unit_of_measure,
              taxAmount: item.tax_type !== 'GRAVADO' || inv.dte_type === '14' ? 0
                : Number((Number(item.total) * (inv.dte_type === '01' ? 13 / 113 : 0.13)).toFixed(2)),
              total: Number(item.total)
            })),
            subtotalGravado: Number(inv.subtotal_gravado || 0),
            subtotalExento: Number(inv.subtotal_exento || 0),
            subtotalNoSujeto: Number(inv.subtotal_no_sujeto || 0),
            descuentoTotal: Number(inv.descuento_total || 0),
            iva13: Number(inv.iva13 || 0),
            retencion1: Number(inv.retencion1 || 0),
            percepcion1: Number(inv.percepcion1 || 0),
            retencionRenta10: Number(inv.retencion_renta10 || 0),
            totalPagar: Number(inv.total_pagar || 0),
            totalLetras: inv.total_letras || '',
            observations: inv.observations || undefined,
            mhReceptionStamp: inv.mh_reception_stamp || undefined,
            mhResponseDate: inv.mh_reception_stamp ? inv.created_at : undefined
          }));
          setInvoices(mappedInvoices);
        } else {
          // Si la base de datos de Supabase no tiene facturas aun, arrancar limpio
          setInvoices([]);
        }

        // 5. Fetch Purchases (Compras)
        const cloudPurchases = results[4].data || [];
        if (cloudPurchases && cloudPurchases.length > 0) {
          const mappedPurchases: PurchaseDocument[] = cloudPurchases.map(pur => ({
            id: pur.id,
            companyId: pur.company_id,
            docType: pur.dte_type === '03' ? 'CCF' : pur.dte_type === '14' ? 'SUJETO_EXCLUIDO'
              : pur.dte_type === '05' ? 'NOTA_CREDITO' : 'FACTURA',
            docNumber: pur.control_number,
            generationCode: pur.generation_code,
            emissionDate: pur.date,
            supplierName: pur.supplier_name,
            supplierNit: pur.supplier_nit,
            supplierNrc: pur.supplier_nrc || '',
            concept: 'Compra de inventario / servicios',
            purchasesGravadas: Number(pur.subtotal_gravado || 0),
            purchasesExentas: Number(pur.subtotal_exento || 0),
            creditoFiscal: Number(pur.iva13 || 0),
            retencion1: Number(pur.retencion1 || 0),
            totalPagar: Number(pur.total || 0),
            paymentMethod: '01'
          }));
          setPurchases(mappedPurchases);
        } else {
          // Si no hay compras registradas en Supabase, arrancar limpio en 0
          setPurchases([]);
        }
        setIsCloudSyncActive(true);
      } catch (err) {
        setIsCloudSyncActive(false);
        toast.error('No se pudo cargar la información de la nube', {
          description: 'Verifique la conexión y los permisos. No se mostrarán datos de demostración como datos reales.'
        });
        console.error('Error loading data from Supabase:', err);
      }
    };

    loadCloudData();
  }, []);

  // Sync to localStorage as local backup
  useEffect(() => {
    if (!useCloud) writeBackup('sivarconta_companies', companies);
  }, [companies]);

  useEffect(() => {
    if (!useCloud) writeBackup('sivarconta_products', products);
  }, [products]);

  useEffect(() => {
    if (!useCloud) writeBackup('sivarconta_clients', clients);
  }, [clients]);

  useEffect(() => {
    if (!useCloud) writeBackup('sivarconta_invoices', invoices);
  }, [invoices]);

  useEffect(() => {
    if (!useCloud) writeBackup('sivarconta_purchases', purchases);
  }, [purchases]);

  const currentCompany = companies.find(c => c.id === currentCompanyId) || companies[0] || UNSELECTED_COMPANY;

  const filteredProducts = products.filter(p => p.companyId === currentCompanyId);
  const filteredClients = clients.filter(c => c.companyId === currentCompanyId);
  const filteredInvoices = invoices.filter(i => i.companyId === currentCompanyId);
  const filteredPurchases = purchases.filter(p => p.companyId === currentCompanyId);

  const startNewInvoiceWithDte = (dte: DteType) => {
    setSelectedDteTypeForNew(dte);
    setCurrentView('new-invoice');
  };

  const getEffectiveCompanyId = () => {
    if (!companies.some(company => company.id === currentCompanyId)) {
      throw new Error('Seleccione una empresa disponible antes de guardar.');
    }
    return currentCompanyId;
  };

  const persistRows = async (table: string, rows: Record<string, unknown>[]) => {
    if (!useCloud || !supabase) return;
    try {
      const { error } = await supabase.from(table).insert(rows);
      if (error) throw error;
    } catch (error) {
      setIsCloudSyncActive(false);
      toast.error('No se pudo guardar en la nube', {
        description: 'Los datos no se confirmaron. Conserve el formulario y vuelva a intentarlo.'
      });
      throw error;
    }
  };

  const persistDemo = (key: string, rows: unknown[]) => {
    if (useCloud || writeBackup(key, rows)) return;
    toast.error('No se pudo guardar en este navegador', {
      description: 'El almacenamiento está bloqueado o lleno. Conserve el formulario y vuelva a intentarlo.'
    });
    throw new Error('No se pudo guardar la copia local.');
  };

  const addCompany = async (companyData: Omit<Company, 'id'>): Promise<Company> => {
    const newId = generateUUID();
    const newComp: Company = {
      ...companyData,
      id: newId
    };

    // Push to Supabase if configured
    if (useCloud && supabase) {
        await persistRows('companies', [{
          id: newId,
          name: companyData.name,
          trade_name: companyData.tradeName || companyData.name,
          nit: companyData.nit,
          nrc: companyData.nrc,
          economic_activity_code: companyData.economicActivityCode || '46510',
          economic_activity_desc: companyData.economicActivity || 'Comercio',
          phone: companyData.phone,
          email: companyData.email,
          address: companyData.address,
          department_code: '06',
          municipality_code: '14',
          establishment_code: companyData.establishmentCode || 'M001',
          pos_code: companyData.posCode || 'P001',
          is_gran_contribuyente: companyData.taxpayerType === 'GRAN_CONTRIBUYENTE',
          mh_environment: companyData.mhEnvironment || 'PRUEBAS'
        }]);
    }

    persistDemo('sivarconta_companies', [newComp, ...companies]);
    setCompanies(prev => [newComp, ...prev]);
    setCurrentCompanyIdState(newId);
    setActiveDtePreview(null);

    toast.success('Empresa registrada exitosamente', {
      description: `${newComp.name} • NRC: ${newComp.nrc}`
    });

    return newComp;
  };

  const addProduct = async (productData: Omit<Product, 'id' | 'companyId'>) => {
    const effCompanyId = getEffectiveCompanyId();
    const newProd: Product = {
      ...productData,
      id: generateUUID(),
      companyId: effCompanyId
    };

    // Push to Supabase if configured
    if (useCloud && supabase) {
        await persistRows('products', [{
          id: newProd.id,
          company_id: effCompanyId,
          code: productData.code,
          name: productData.name,
          description: productData.description,
          price: productData.unitPrice,
          tax_type: productData.taxType,
          unit_of_measure: productData.unitOfMeasure,
          stock: productData.stock || 0
        }]);
    }

    persistDemo('sivarconta_products', [newProd, ...products]);
    setProducts(prev => [newProd, ...prev]);

    toast.success('Producto agregado al catálogo', {
      description: `${newProd.name} • $${newProd.unitPrice.toFixed(2)} (${newProd.taxType})`
    });
  };

  const addClient = async (clientData: Omit<Client, 'id' | 'companyId'>) => {
    const effCompanyId = getEffectiveCompanyId();
    const newCli: Client = {
      ...clientData,
      id: generateUUID(),
      companyId: effCompanyId
    };

    // Push to Supabase if configured
    if (useCloud && supabase) {
        await persistRows('clients', [{
          id: newCli.id,
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
    }

    persistDemo('sivarconta_clients', [newCli, ...clients]);
    setClients(prev => [newCli, ...prev]);

    toast.success('Cliente registrado exitosamente', {
      description: `${newCli.name} • ${newCli.docType}: ${newCli.docNumber}`
    });
  };

  const addPurchase = async (purchaseData: Omit<PurchaseDocument, 'id' | 'companyId'>) => {
    const effCompanyId = getEffectiveCompanyId();
    const newPur: PurchaseDocument = {
      ...purchaseData,
      id: generateUUID(),
      companyId: effCompanyId
    };

    // Push to Supabase if configured
    if (useCloud && supabase) {
        await persistRows('purchases', [{
          id: newPur.id,
          company_id: effCompanyId,
          dte_type: purchaseData.docType === 'CCF' ? '03' : purchaseData.docType === 'SUJETO_EXCLUIDO' ? '14' : purchaseData.docType === 'NOTA_CREDITO' ? '05' : '01',
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
    }

    persistDemo('sivarconta_purchases', [newPur, ...purchases]);
    setPurchases(prev => [newPur, ...prev]);

    toast.success('Compra registrada en Libros de IVA', {
      description: `${newPur.supplierName} • Total: $${newPur.totalPagar.toFixed(2)}`
    });
  };

  const createInvoice = async (invoicePayload: any): Promise<InvoiceDocument> => {
    const effCompanyId = getEffectiveCompanyId();
    const now = new Date();
    const dateParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/El_Salvador', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    }).formatToParts(now);
    const part = (type: Intl.DateTimeFormatPartTypes) => dateParts.find(value => value.type === type)?.value || '';
    const emissionDate = `${part('year')}-${part('month')}-${part('day')}`;
    const emissionTime = `${part('hour')}:${part('minute')}:${part('second')}`;
    const generationCode = generateUUID();
    
    // Correlative for this DTE type
    const prefix = `DTE-${invoicePayload.dteType}-${currentCompany.establishmentCode}${currentCompany.posCode}-`;
    const existingMax = Math.max(100, ...filteredInvoices
      .filter(invoice => invoice.controlNumber.startsWith(prefix))
      .map(invoice => Number(invoice.controlNumber.slice(prefix.length)))
      .filter(Number.isSafeInteger));
    const reservationKey = `${effCompanyId}:${prefix}`;
    const correlative = Math.max(existingMax, reservedCorrelatives.current.get(reservationKey) || 0) + 1;
    reservedCorrelatives.current.set(reservationKey, correlative);
    const controlNumber = generateControlNumber(
      invoicePayload.dteType,
      correlative,
      currentCompany.establishmentCode,
      currentCompany.posCode
    );

    const newInvoice: InvoiceDocument = {
      ...invoicePayload,
      id: generateUUID(),
      companyId: effCompanyId,
      generationCode,
      controlNumber,
      emissionDate,
      emissionTime,
      establishmentCode: currentCompany.establishmentCode,
      posCode: currentCompany.posCode,
      status: 'BORRADOR',
      mhReceptionStamp: undefined,
      mhResponseDate: undefined,
      mhQrUrl: undefined
    };

    // Push to Supabase if configured
    if (useCloud && supabase) {
        await persistRows('invoices', [{
          id: newInvoice.id,
          company_id: effCompanyId,
          dte_type: newInvoice.dteType,
          control_number: newInvoice.controlNumber,
          generation_code: newInvoice.generationCode,
          client_id: filteredClients.some(client => client.id === newInvoice.clientId)
            && /^[0-9a-f-]{36}$/i.test(newInvoice.clientId) ? newInvoice.clientId : null,
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
          status: 'BORRADOR',
          mh_reception_stamp: null,
          observations: newInvoice.observations || null
        }]);
      if (newInvoice.items.length > 0) {
        await persistRows('invoice_items', newInvoice.items.map((item, index) => ({
          id: generateUUID(),
          invoice_id: newInvoice.id,
          num_item: index + 1,
          product_id: item.productId && filteredProducts.some(product => product.id === item.productId)
            && /^[0-9a-f-]{36}$/i.test(item.productId) ? item.productId : null,
          description: item.description,
          code: item.code,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          discount: item.discount,
          tax_type: item.taxType,
          unit_of_measure: item.unitOfMeasure,
          total: item.total
        })));
      }
    }

    persistDemo('sivarconta_invoices', [newInvoice, ...invoices]);
    setInvoices(prev => [newInvoice, ...prev]);
    toast.success('Documento de prueba guardado', {
      description: 'Borrador sin validez fiscal. No ha sido firmado ni enviado al Ministerio de Hacienda.'
    });

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
        addCompany,
        addProduct,
        addClient,
        addPurchase,
        filteredProducts,
        filteredClients,
        filteredInvoices,
        filteredPurchases,
        isCloudSyncActive,
        dataMode: useCloud ? 'cloud' : 'local-demo'
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
