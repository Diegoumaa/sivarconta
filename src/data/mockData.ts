import { Company, Client, Product, InvoiceDocument, PurchaseDocument } from '../types';

export const INITIAL_COMPANIES: Company[] = [
  {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    name: 'Distribuidora Cuscatlán, S.A. de C.V.',
    tradeName: 'Distribuidora Cuscatlán',
    nit: '0614-120518-102-1',
    nrc: '289410-4',
    economicActivity: 'Venta al por mayor y menor de equipo tecnológico y suministros',
    economicActivityCode: '46510',
    taxpayerType: 'GRAN_CONTRIBUYENTE',
    department: 'San Salvador',
    municipality: 'San Salvador Centro',
    address: 'Alameda Roosevelt y 45 Av. Sur, Edificio Cuscatlán, Nivel 3, San Salvador',
    phone: '+503 2298-4400',
    email: 'facturacion@distribuidoracuscatlan.sv',
    mhEnvironment: 'PRUEBAS',
    mhUser: 'DTE_06141205181021',
    establishmentCode: 'M001',
    posCode: 'P001'
  },
  {
    id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    name: 'SIVAR Consultores & Asociados, S.A.',
    tradeName: 'SIVARCONTA Despacho',
    nit: '0614-250820-101-3',
    nrc: '310542-8',
    economicActivity: 'Servicios de asesoría contable, auditoría y consultoría tributaria',
    economicActivityCode: '69200',
    taxpayerType: 'MEDIANO',
    department: 'La Libertad',
    municipality: 'Santa Tecla',
    address: 'Boulevard Merliot, Pasaje Las Magnolias #12, Santa Tecla',
    phone: '+503 2511-9000',
    email: 'contacto@sivarconta.com',
    mhEnvironment: 'PRUEBAS',
    mhUser: 'DTE_06142508201013',
    establishmentCode: 'M001',
    posCode: 'P001'
  }
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    companyId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    code: 'TEC-001',
    name: 'Laptop Dell Latitude 5420 i7 16GB',
    description: 'Computadora portátil empresarial con SSD 512GB, pantalla FHD',
    unitPrice: 750.00,
    taxType: 'GRAVADO',
    unitOfMeasure: '59', // Unidad
    category: 'Hardware',
    stock: 15
  },
  {
    id: 'prod-2',
    companyId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    code: 'TEC-002',
    name: 'Disco Sólido SSD Kingston 1TB NVMe',
    description: 'Almacenamiento de alta velocidad M.2 PCIe 4.0',
    unitPrice: 85.00,
    taxType: 'GRAVADO',
    unitOfMeasure: '59',
    category: 'Componentes',
    stock: 40
  },
  {
    id: 'prod-3',
    companyId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    code: 'TEC-003',
    name: 'Monitor LG 27 Pulgadas IPS FHD',
    description: 'Monitor profesional antirreflejo HDMI/DisplayPort',
    unitPrice: 195.00,
    taxType: 'GRAVADO',
    unitOfMeasure: '59',
    category: 'Monitores',
    stock: 22
  },
  {
    id: 'prod-4',
    companyId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    code: 'SERV-001',
    name: 'Instalación y Configuración de Servidor',
    description: 'Puesta en marcha y migración de base de datos en nube',
    unitPrice: 250.00,
    taxType: 'GRAVADO',
    unitOfMeasure: '99', // Servicio
    category: 'Servicios',
    stock: 999
  },
  // Productos para Despacho Sivar
  {
    id: 'prod-5',
    companyId: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    code: 'CONT-001',
    name: 'Iguala Mensual Contable PYME (Hasta 100 docs)',
    description: 'Elaboración de Libros de IVA, declaración F07, conciliación bancaria',
    unitPrice: 175.00,
    taxType: 'GRAVADO',
    unitOfMeasure: '99',
    category: 'Asesoría Recurrente'
  },
  {
    id: 'prod-6',
    companyId: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    code: 'CONT-002',
    name: 'Auditoría Fiscal y Dictamen Anual',
    description: 'Revisión técnica de cumplimiento tributario ante Ministerio de Hacienda',
    unitPrice: 850.00,
    taxType: 'GRAVADO',
    unitOfMeasure: '99',
    category: 'Auditoría'
  },
  {
    id: 'prod-7',
    companyId: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    code: 'CONT-003',
    name: 'Capacitación Tributaria DTE para Personal',
    description: 'Taller de 8 horas sobre normativa de Facturación Electrónica',
    unitPrice: 120.00,
    taxType: 'EXENTO',
    unitOfMeasure: '99',
    category: 'Capacitación'
  },
  {
    id: 'prod-8',
    companyId: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    code: 'SERV-EXT-01',
    name: 'Servicio de Fontanería y Reparación Oficina',
    description: 'Reparación de tuberías y sanitarios en instalaciones',
    unitPrice: 80.00,
    taxType: 'GRAVADO',
    unitOfMeasure: '99',
    category: 'Servicios de Terceros'
  }
];

export const INITIAL_CLIENTS: Client[] = [
  {
    id: 'cli-1',
    companyId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    name: 'Farmacéutica Santa Lucía, S.A. de C.V.',
    commercialName: 'Farmacias Santa Lucía',
    docType: 'NIT',
    docNumber: '0614-040995-103-2',
    nrc: '154890-3',
    taxpayerType: 'GRAN_CONTRIBUYENTE',
    economicActivity: 'Venta de productos farmacéuticos y medicinales',
    department: 'San Salvador',
    municipality: 'San Salvador Centro',
    address: 'Calle Arce y 19 Av. Norte #204, San Salvador',
    phone: '+503 2235-9000',
    email: 'cuentasporpagar@santalucia.sv'
  },
  {
    id: 'cli-2',
    companyId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    name: 'Carlos Roberto Alvarado Menjívar',
    docType: 'DUI',
    docNumber: '03891044-8',
    taxpayerType: 'PEQUENO',
    department: 'La Libertad',
    municipality: 'Antiguo Cuscatlán',
    address: 'Residencial Santa Elena, Polígono B, Casa 14',
    phone: '+503 7890-1234',
    email: 'carlos.alvarado@gmail.com'
  },
  {
    id: 'cli-3',
    companyId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    name: 'Ferretería & Construcciones El Progreso',
    commercialName: 'El Progreso Ferreterías',
    docType: 'NIT',
    docNumber: '0501-180410-101-5',
    nrc: '249102-1',
    taxpayerType: 'MEDIANO',
    economicActivity: 'Venta de materiales de construcción y ferretería',
    department: 'Santa Ana',
    municipality: 'Santa Ana Centro',
    address: 'Av. Independencia Sur #45, Santa Ana',
    phone: '+503 2440-5566',
    email: 'compras@ferreteriaelprogreso.sv'
  },
  {
    id: 'cli-4',
    companyId: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    name: 'Taller Mecánico Automotriz Los Héroes',
    commercialName: 'Taller Los Héroes',
    docType: 'NIT',
    docNumber: '0614-290115-104-9',
    nrc: '278910-6',
    taxpayerType: 'PEQUENO',
    economicActivity: 'Mantenimiento y reparación de vehículos automotores',
    department: 'San Salvador',
    municipality: 'San Salvador Centro',
    address: 'Boulevard Los Héroes #1024, San Salvador',
    phone: '+503 2260-8899',
    email: 'tallerlosheroes@outlook.com'
  },
  {
    id: 'cli-5',
    companyId: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    name: 'José Dolores Renderos (Fontanero Independiente)',
    docType: 'DUI',
    docNumber: '01894231-5',
    taxpayerType: 'OTRO',
    department: 'San Salvador',
    municipality: 'Mejicanos',
    address: 'Colonia Zacamil, Edificio 12, Apto 3',
    phone: '+503 7654-3210',
    email: 'dolores.renderos@yahoo.es'
  }
];

export const INITIAL_INVOICES: InvoiceDocument[] = [
  {
    id: 'inv-1',
    companyId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    dteType: '03', // CCF
    generationCode: '9B2C4F61-8931-4A52-B4D8-28C1A87D09E1',
    controlNumber: 'DTE-03-M001P001-000000000000104',
    emissionDate: '2026-09-18',
    emissionTime: '10:35:22',
    establishmentCode: 'M001',
    posCode: 'P001',
    clientId: 'cli-1',
    clientName: 'Farmacéutica Santa Lucía, S.A. de C.V.',
    clientDocType: 'NIT',
    clientDocNumber: '0614-040995-103-2',
    clientNrc: '154890-3',
    clientAddress: 'Calle Arce y 19 Av. Norte #204, San Salvador',
    clientDepartment: 'San Salvador',
    clientMunicipality: 'San Salvador Centro',
    clientEmail: 'cuentasporpagar@santalucia.sv',
    clientPhone: '+503 2235-9000',
    items: [
      {
        id: 'item-1',
        productId: 'prod-1',
        code: 'TEC-001',
        description: 'Laptop Dell Latitude 5420 i7 16GB',
        quantity: 2,
        unitPrice: 750.00,
        discount: 0,
        taxType: 'GRAVADO',
        unitOfMeasure: '59',
        taxAmount: 195.00,
        total: 1500.00
      }
    ],
    paymentMethod: '04', // Transferencia
    condition: 'CREDITO',
    creditTermDays: 30,
    subtotalGravado: 1500.00,
    subtotalExento: 0,
    subtotalNoSujeto: 0,
    descuentoTotal: 0,
    iva13: 195.00,
    retencion1: 15.00, // Gran Contribuyente
    retencionRenta10: 0,
    totalPagar: 1680.00,
    totalLetras: 'MIL SEISCIENTOS OCHENTA DÓLARES CON 00/100 USD',
    observations: 'Entrega en sucursal central con acta de recepción',
    status: 'PROCESADO_MH',
    mhReceptionStamp: '2026B1E97C823901AD378F291B098C91340192A0',
    mhResponseDate: '2026-09-18 10:35:25',
    mhQrUrl: 'https://admin.factura.gob.sv/consultaPublica?ambiente=00&codGen=9B2C4F61-8931-4A52-B4D8-28C1A87D09E1&fechaEmi=2026-09-18'
  },
  {
    id: 'inv-2',
    companyId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    dteType: '01', // Factura Consumidor Final
    generationCode: '4C810E23-B310-48F1-A814-F092A76B8194',
    controlNumber: 'DTE-01-M001P001-000000000000215',
    emissionDate: '2026-09-20',
    emissionTime: '15:12:08',
    establishmentCode: 'M001',
    posCode: 'P001',
    clientId: 'cli-2',
    clientName: 'Carlos Roberto Alvarado Menjívar',
    clientDocType: 'DUI',
    clientDocNumber: '03891044-8',
    clientAddress: 'Residencial Santa Elena, Polígono B, Casa 14',
    clientDepartment: 'La Libertad',
    clientMunicipality: 'Antiguo Cuscatlán',
    clientEmail: 'carlos.alvarado@gmail.com',
    clientPhone: '+503 7890-1234',
    items: [
      {
        id: 'item-2',
        productId: 'prod-2',
        code: 'TEC-002',
        description: 'Disco Sólido SSD Kingston 1TB NVMe',
        quantity: 1,
        unitPrice: 85.00,
        discount: 5.00,
        taxType: 'GRAVADO',
        unitOfMeasure: '59',
        taxAmount: 9.20,
        total: 80.00
      }
    ],
    paymentMethod: '02', // Tarjeta Débito
    condition: 'CONTADO',
    subtotalGravado: 80.00,
    subtotalExento: 0,
    subtotalNoSujeto: 0,
    descuentoTotal: 5.00,
    iva13: 9.20,
    retencion1: 0,
    retencionRenta10: 0,
    totalPagar: 80.00,
    totalLetras: 'OCHENTA DÓLARES CON 00/100 USD',
    observations: 'Garantía 12 meses con serie de fábrica',
    status: 'PROCESADO_MH',
    mhReceptionStamp: '2026D741029482710398A91B098C9134019200B3',
    mhResponseDate: '2026-09-20 15:12:10',
    mhQrUrl: 'https://admin.factura.gob.sv/consultaPublica?ambiente=00&codGen=4C810E23-B310-48F1-A814-F092A76B8194&fechaEmi=2026-09-20'
  },
  {
    id: 'inv-3',
    companyId: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    dteType: '03', // CCF
    generationCode: '1A98BC23-1102-4D90-9812-78FA9102B452',
    controlNumber: 'DTE-03-M001P001-000000000000042',
    emissionDate: '2026-09-21',
    emissionTime: '09:00:15',
    establishmentCode: 'M001',
    posCode: 'P001',
    clientId: 'cli-4',
    clientName: 'Taller Mecánico Automotriz Los Héroes',
    clientDocType: 'NIT',
    clientDocNumber: '0614-290115-104-9',
    clientNrc: '278910-6',
    clientAddress: 'Boulevard Los Héroes #1024, San Salvador',
    clientDepartment: 'San Salvador',
    clientMunicipality: 'San Salvador Centro',
    clientEmail: 'tallerlosheroes@outlook.com',
    clientPhone: '+503 2260-8899',
    items: [
      {
        id: 'item-3',
        productId: 'prod-5',
        code: 'CONT-001',
        description: 'Iguala Mensual Contable PYME - Septiembre 2026',
        quantity: 1,
        unitPrice: 175.00,
        discount: 0,
        taxType: 'GRAVADO',
        unitOfMeasure: '99',
        taxAmount: 22.75,
        total: 175.00
      }
    ],
    paymentMethod: '04',
    condition: 'CONTADO',
    subtotalGravado: 175.00,
    subtotalExento: 0,
    subtotalNoSujeto: 0,
    descuentoTotal: 0,
    iva13: 22.75,
    retencion1: 0,
    retencionRenta10: 0,
    totalPagar: 197.75,
    totalLetras: 'CIENTO NOVENTA Y SIETE DÓLARES CON 75/100 USD',
    observations: 'Honorarios contables mensuales',
    status: 'PROCESADO_MH',
    mhReceptionStamp: '2026A890129487561938F291B098C91340192CD9',
    mhResponseDate: '2026-09-21 09:00:18',
    mhQrUrl: 'https://admin.factura.gob.sv/consultaPublica?ambiente=00&codGen=1A98BC23-1102-4D90-9812-78FA9102B452&fechaEmi=2026-09-21'
  },
  {
    id: 'inv-4',
    companyId: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    dteType: '14', // Sujeto Excluido
    generationCode: '7F014E32-4412-4B99-8801-DDA89104A112',
    controlNumber: 'DTE-14-M001P001-000000000000010',
    emissionDate: '2026-09-22',
    emissionTime: '11:45:00',
    establishmentCode: 'M001',
    posCode: 'P001',
    clientId: 'cli-5',
    clientName: 'José Dolores Renderos (Fontanero Independiente)',
    clientDocType: 'DUI',
    clientDocNumber: '01894231-5',
    clientAddress: 'Colonia Zacamil, Edificio 12, Apto 3',
    clientDepartment: 'San Salvador',
    clientMunicipality: 'Mejicanos',
    clientEmail: 'dolores.renderos@yahoo.es',
    clientPhone: '+503 7654-3210',
    items: [
      {
        id: 'item-4',
        productId: 'prod-8',
        code: 'SERV-EXT-01',
        description: 'Reparación de filtración en baño principal del despacho',
        quantity: 1,
        unitPrice: 80.00,
        discount: 0,
        taxType: 'GRAVADO',
        unitOfMeasure: '99',
        taxAmount: 0,
        total: 80.00
      }
    ],
    paymentMethod: '01', // Efectivo
    condition: 'CONTADO',
    subtotalGravado: 80.00,
    subtotalExento: 0,
    subtotalNoSujeto: 0,
    descuentoTotal: 0,
    iva13: 0,
    retencion1: 0,
    retencionRenta10: 8.00, // 10% Renta Sujeto Excluido
    totalPagar: 72.00,
    totalLetras: 'SETENTA Y DOS DÓLARES CON 00/100 USD',
    observations: 'Compra a sujeto no inscrito en IVA con retención del 10% de Renta',
    status: 'PROCESADO_MH',
    mhReceptionStamp: '2026C9912093847561938F291B098C91340192E8',
    mhResponseDate: '2026-09-22 11:45:04',
    mhQrUrl: 'https://admin.factura.gob.sv/consultaPublica?ambiente=00&codGen=7F014E32-4412-4B99-8801-DDA89104A112&fechaEmi=2026-09-22'
  }
];

export const INITIAL_PURCHASES: PurchaseDocument[] = [
  {
    id: 'pur-1',
    companyId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    docType: 'CCF',
    docNumber: 'CCF-001928',
    generationCode: '5D918234-A821-49F1-8812-9018247B1294',
    emissionDate: '2026-09-10',
    supplierName: 'Mayorista de Tecnología Latinoamericano, S.A.',
    supplierNrc: '189201-5',
    supplierNit: '0614-150612-101-9',
    concept: 'Lote de 10 Laptops y memorias para inventario',
    purchasesGravadas: 4500.00,
    purchasesExentas: 0,
    creditoFiscal: 585.00,
    retencion1: 45.00,
    totalPagar: 5040.00,
    paymentMethod: 'Transferencia 365'
  },
  {
    id: 'pur-2',
    companyId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    docType: 'CCF',
    docNumber: 'CCF-088192',
    generationCode: '1A982103-B912-4018-9128-48910294C102',
    emissionDate: '2026-09-15',
    supplierName: 'Compañía de Alumbrado Eléctrico de San Salvador (CAESS)',
    supplierNrc: '120938-1',
    supplierNit: '0614-010190-101-2',
    concept: 'Consumo eléctrico sede administrativa Septiembre',
    purchasesGravadas: 180.00,
    purchasesExentas: 0,
    creditoFiscal: 23.40,
    retencion1: 0,
    totalPagar: 203.40,
    paymentMethod: 'Pago electrónico'
  },
  {
    id: 'pur-3',
    companyId: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    docType: 'CCF',
    docNumber: 'CCF-004510',
    generationCode: '8E192039-C812-4091-8812-9018274B1029',
    emissionDate: '2026-09-12',
    supplierName: 'Librería e Impresos La Palma S.A.',
    supplierNrc: '194820-3',
    supplierNit: '0614-220805-102-4',
    concept: 'Resmas de papel bond, tóner para impresoras contables',
    purchasesGravadas: 95.00,
    purchasesExentas: 0,
    creditoFiscal: 12.35,
    retencion1: 0,
    totalPagar: 107.35,
    paymentMethod: 'Efectivo'
  }
];

export const SALVADOR_DEPARTMENTS = [
  'Ahuachapán', 'Cabañas', 'Chalatenango', 'Cuscatlán',
  'La Libertad', 'La Paz', 'La Unión', 'Morazán',
  'San Miguel', 'San Salvador', 'San Vicente', 'Santa Ana',
  'Sonsonate', 'Usulután'
];
