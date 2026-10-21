import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Company, Product, Client, InvoiceDocument, PurchaseDocument, DteType } from '../types';
import { INITIAL_COMPANIES, INITIAL_PRODUCTS, INITIAL_CLIENTS, INITIAL_INVOICES, INITIAL_PURCHASES } from '../data/mockData';
import { generateUUID, generateControlNumber } from '../utils/dteUtils';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { readBackup, writeBackup } from '../lib/localBackup';
import { toast } from 'sonner';
import { NavigationProvider, useNavigation, useNavigationActions } from './NavigationContext';
import { loadCompanies, loadCompanySnapshot, mapInvoices, type CompanySnapshot } from '../services/companyRepository';

interface AppDataContextType {
  companies: Company[];
  currentCompany: Company;
  currentCompanyId: string;
  setCurrentCompanyId: (id: string) => void;
  products: Product[];
  clients: Client[];
  invoices: InvoiceDocument[];
  purchases: PurchaseDocument[];







  createInvoice: (data: InvoiceDraft) => Promise<InvoiceDocument>;
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
  dataStatus: 'loading' | 'ready' | 'error';
  refreshData: () => void;
}

export type InvoiceDraft = Omit<InvoiceDocument, 'id' | 'companyId' | 'generationCode' | 'controlNumber' | 'emissionDate' | 'emissionTime' | 'establishmentCode' | 'posCode' | 'status' | 'retencionRenta10'> & { retencionRenta10?: number };
const AppContext = createContext<AppDataContextType | undefined>(undefined);

const UNSELECTED_COMPANY: Company = {
  id: '', name: 'Seleccione una empresa', tradeName: 'Sin empresa disponible',
  nit: '', nrc: '', economicActivity: '', economicActivityCode: '', taxpayerType: 'OTRO',
  department: '', municipality: '', address: '', phone: '', email: '',
  mhEnvironment: 'PRUEBAS', mhUser: '', establishmentCode: 'M001', posCode: 'P001'
};

const AppDataProvider: React.FC<{ children: React.ReactNode; demo?: boolean }> = ({ children, demo = false }) => {
  const useCloud = isSupabaseConfigured && !demo;
  const { setCurrentView, setActiveDtePreview } = useNavigationActions();
  const [dataStatus, setDataStatus] = useState<'loading' | 'ready' | 'error'>(useCloud ? 'loading' : 'ready');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const snapshotCache = useRef(new Map<string, { snapshot: CompanySnapshot; fetchedAt: number }>());
  const refreshData = () => { snapshotCache.current.clear(); setRefreshVersion(version => version + 1); };
  // Explicit demos never reuse caches left by older cloud-enabled builds.
  const localKey = (key: string) => demo ? key.replace('sivarconta_', 'sivarconta_demo_v2_') : key;
  const readLocalBackup = <T,>(key: string, fallback: T[]) => readBackup<T>(localKey(key), fallback);
  const writeLocalBackup = (key: string, value: unknown) => writeBackup(localKey(key), value);
  const [companies, setCompanies] = useState<Company[]>(() =>
    useCloud ? [] : readLocalBackup('sivarconta_companies', INITIAL_COMPANIES));

  const [currentCompanyId, setCurrentCompanyIdState] = useState<string>(() => {
    const firstId = companies[0]?.id;
    return firstId || '';
  });

  const [products, setProducts] = useState<Product[]>(() => {
    return useCloud ? [] : readLocalBackup('sivarconta_products', INITIAL_PRODUCTS);
  });

  const [clients, setClients] = useState<Client[]>(() => {
    return useCloud ? [] : readLocalBackup('sivarconta_clients', INITIAL_CLIENTS);
  });

  const [invoices, setInvoices] = useState<InvoiceDocument[]>(() => {
    return useCloud ? [] : readLocalBackup('sivarconta_invoices', INITIAL_INVOICES);
  });

  const [purchases, setPurchases] = useState<PurchaseDocument[]>(() => {
    return useCloud ? [] : readLocalBackup('sivarconta_purchases', INITIAL_PURCHASES);
  });

  const [isCloudSyncActive, setIsCloudSyncActive] = useState(false);
  const reservedCorrelatives = useRef(new Map<string, number>());
  const pendingCloudDrafts = useRef(new Map<string, InvoiceDocument>());

  const setCurrentCompanyId = (id: string) => {
    if (!companies.some(company => company.id === id)) return;
    if (useCloud && id !== currentCompanyId) setDataStatus('loading');
    setCurrentCompanyIdState(id);
    setActiveDtePreview(null);
    setCurrentView('dashboard');
  };

  // Session-scoped cache: never shared across users or between cloud and demo.
  useEffect(() => {
    if (!useCloud || !supabase) return;
    let alive = true;
    setDataStatus('loading');
    loadCompanies(supabase).then(next => {
      if (!alive) return;
      setCompanies(next);
      setCurrentCompanyIdState(previous => next.some(company => company.id === previous) ? previous : next[0]?.id || '');
      if (!next.length) { setDataStatus('ready'); setIsCloudSyncActive(true); }
    }).catch(() => {
      if (!alive) return;
      setDataStatus('error'); setIsCloudSyncActive(false);
      toast.error('No se pudieron cargar tus empresas', { description: 'Revisa tu conexión y los permisos. Puedes volver a intentarlo.' });
    });
    return () => { alive = false; };
  }, [useCloud, refreshVersion]);

  useEffect(() => {
    if (!useCloud || !supabase || !currentCompanyId) return;
    let alive = true;
    const applySnapshot = (snapshot: CompanySnapshot) => {
      setClients(snapshot.clients); setProducts(snapshot.products);
      setInvoices(snapshot.invoices); setPurchases(snapshot.purchases);
      setDataStatus('ready'); setIsCloudSyncActive(true);
    };
    const cached = snapshotCache.current.get(currentCompanyId);
    if (cached && Date.now() - cached.fetchedAt < 30_000) {
      applySnapshot(cached.snapshot);
      return;
    }
    setDataStatus('loading'); setIsCloudSyncActive(false);
    setClients([]); setProducts([]); setInvoices([]); setPurchases([]);
    loadCompanySnapshot(supabase, currentCompanyId).then(snapshot => {
      if (!alive) return; // A late response from another company must never replace this view.
      snapshotCache.current.set(currentCompanyId, { snapshot, fetchedAt: Date.now() });
      applySnapshot(snapshot);
    }).catch(() => {
      if (!alive) return;
      setDataStatus('error'); setIsCloudSyncActive(false);
      toast.error('No se pudo cargar la información de la empresa', { description: 'Los totales no están disponibles. Actualiza para reintentar.' });
    });
    return () => { alive = false; };
  }, [useCloud, currentCompanyId, refreshVersion]);

  // Sync to localStorage as local backup
  useEffect(() => {
    if (!useCloud) writeLocalBackup('sivarconta_companies', companies);
  }, [companies]);

  useEffect(() => {
    if (!useCloud) writeLocalBackup('sivarconta_products', products);
  }, [products]);

  useEffect(() => {
    if (!useCloud) writeLocalBackup('sivarconta_clients', clients);
  }, [clients]);

  useEffect(() => {
    if (!useCloud) writeLocalBackup('sivarconta_invoices', invoices);
  }, [invoices]);

  useEffect(() => {
    if (!useCloud) writeLocalBackup('sivarconta_purchases', purchases);
  }, [purchases]);

  const currentCompany = companies.find(c => c.id === currentCompanyId) || companies[0] || UNSELECTED_COMPANY;

  const filteredProducts = products.filter(p => p.companyId === currentCompanyId);
  const filteredClients = clients.filter(c => c.companyId === currentCompanyId);
  const filteredInvoices = invoices.filter(i => i.companyId === currentCompanyId);
  const filteredPurchases = purchases.filter(p => p.companyId === currentCompanyId);


  const getEffectiveCompanyId = () => {
    if (!companies.some(company => company.id === currentCompanyId)) {
      throw new Error('Seleccione una empresa disponible antes de guardar.');
    }
    return currentCompanyId;
  };

  const persistRows = async (table: string, rows: Record<string, unknown>[]) => {
    if (!useCloud || !supabase) return;
    try {
      const { data, error } = table === 'companies'
        ? await supabase.rpc('create_company', { company_data: rows[0] })
        : table === 'invoices'
          ? await supabase.rpc('save_invoice_draft', { draft: rows[0] })
          : await supabase.from(table).insert(rows);
      if (error) throw error;
      snapshotCache.current.delete(currentCompanyId);
      return data;
    } catch (error) {
      setIsCloudSyncActive(false);
      toast.error('No se pudo guardar en la nube', {
        description: 'Los datos no se confirmaron. Conserve el formulario y vuelva a intentarlo.'
      });
      throw error;
    }
  };

  const persistDemo = (key: string, rows: unknown[]) => {
    if (useCloud || writeLocalBackup(key, rows)) return;
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
          mh_environment: companyData.mhEnvironment || 'PRUEBAS',
          department: companyData.department,
          municipality: companyData.municipality,
          taxpayer_type: companyData.taxpayerType,
          mh_user: companyData.mhUser
        }]);
    }

    persistDemo('sivarconta_companies', [newComp, ...companies]);
    setCompanies(prev => [newComp, ...prev]);
    if (useCloud) setDataStatus('loading');
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
          stock: productData.stock ?? 0,
          category: productData.category
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
          commercial_name: clientData.commercialName || null,
          taxpayer_type: clientData.taxpayerType,
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
          total: purchaseData.totalPagar,
          concept: purchaseData.concept,
          payment_method: purchaseData.paymentMethod,
          retencion_renta10: purchaseData.retencionRenta10 ?? 0
        }]);
    }

    persistDemo('sivarconta_purchases', [newPur, ...purchases]);
    setPurchases(prev => [newPur, ...prev]);

    toast.success('Compra registrada en Libros de IVA', {
      description: `${newPur.supplierName} • Total: $${newPur.totalPagar.toFixed(2)}`
    });
  };

  const createInvoice = async (invoicePayload: InvoiceDraft): Promise<InvoiceDocument> => {
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

    let newInvoice: InvoiceDocument = {
      ...invoicePayload,
      retencionRenta10: invoicePayload.retencionRenta10 ?? 0,
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
      const requestKey = effCompanyId + ':' + JSON.stringify(invoicePayload);
      newInvoice = pendingCloudDrafts.current.get(requestKey) || newInvoice;
      pendingCloudDrafts.current.set(requestKey, newInvoice);
      const saved = await persistRows('invoices', [{
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
          observations: newInvoice.observations || null,
          referenced_dte: newInvoice.referencedDte || null,
          items: newInvoice.items.map((item, index) => ({
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
          total: Number(item.total.toFixed(2))
          }))
      }]);
      if (!saved?.id || !Array.isArray(saved.invoice_items) || !saved.invoice_items.length) {
        throw new Error('La nube no confirmó el documento completo. Reintenta para verificar el mismo borrador.');
      }
      newInvoice = mapInvoices([saved])[0];
      pendingCloudDrafts.current.delete(requestKey);
    }

    persistDemo('sivarconta_invoices', [newInvoice, ...invoices]);
    setInvoices(prev => [newInvoice, ...prev.filter(invoice => invoice.id !== newInvoice.id)]);
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
        dataMode: useCloud ? 'cloud' : 'local-demo',
        dataStatus, refreshData
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const AppProvider: React.FC<{ children: React.ReactNode; demo?: boolean }> = ({ children, demo }) => (
  <NavigationProvider><AppDataProvider demo={demo}>{children}</AppDataProvider></NavigationProvider>
);

export const useAppData = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

/** Compatibility facade for views that need both domain data and navigation. */
export const useApp = () => ({ ...useAppData(), ...useNavigation() });
