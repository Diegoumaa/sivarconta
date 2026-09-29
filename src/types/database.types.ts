export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      companies: {
        Row: {
          id: string
          name: string
          trade_name: string | null
          nit: string
          nrc: string
          economic_activity_code: string
          economic_activity_desc: string
          phone: string
          email: string
          address: string
          department_code: string
          municipality_code: string
          establishment_code: string
          pos_code: string
          is_gran_contribuyente: boolean
          mh_environment: 'PRUEBAS' | 'PRODUCCION'
          mh_api_key: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          trade_name?: string | null
          nit: string
          nrc: string
          economic_activity_code: string
          economic_activity_desc: string
          phone: string
          email: string
          address: string
          department_code?: string
          municipality_code?: string
          establishment_code?: string
          pos_code?: string
          is_gran_contribuyente?: boolean
          mh_environment?: 'PRUEBAS' | 'PRODUCCION'
          mh_api_key?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          trade_name?: string | null
          nit?: string
          nrc?: string
          economic_activity_code?: string
          economic_activity_desc?: string
          phone?: string
          email?: string
          address?: string
          department_code?: string
          municipality_code?: string
          establishment_code?: string
          pos_code?: string
          is_gran_contribuyente?: boolean
          mh_environment?: 'PRUEBAS' | 'PRODUCCION'
          mh_api_key?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      clients: {
        Row: {
          id: string
          company_id: string
          name: string
          doc_type: 'DUI' | 'NIT' | 'PASAPORTE' | 'OTRO'
          doc_number: string
          nrc: string | null
          economic_activity: string | null
          is_gran_contribuyente: boolean
          email: string
          phone: string
          address: string
          department: string
          municipality: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          doc_type?: 'DUI' | 'NIT' | 'PASAPORTE' | 'OTRO'
          doc_number: string
          nrc?: string | null
          economic_activity?: string | null
          is_gran_contribuyente?: boolean
          email: string
          phone: string
          address: string
          department?: string
          municipality?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          doc_type?: 'DUI' | 'NIT' | 'PASAPORTE' | 'OTRO'
          doc_number?: string
          nrc?: string | null
          economic_activity?: string | null
          is_gran_contribuyente?: boolean
          email?: string
          phone?: string
          address?: string
          department?: string
          municipality?: string
          created_at?: string
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: string
          company_id: string
          code: string
          name: string
          description: string | null
          price: number
          cost: number
          tax_type: 'GRAVADO' | 'EXENTO' | 'NO_SUJETO'
          unit_of_measure: string
          stock: number
          is_service: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          code: string
          name: string
          description?: string | null
          price: number
          cost?: number
          tax_type?: 'GRAVADO' | 'EXENTO' | 'NO_SUJETO'
          unit_of_measure?: string
          stock?: number
          is_service?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          code?: string
          name?: string
          description?: string | null
          price?: number
          cost?: number
          tax_type?: 'GRAVADO' | 'EXENTO' | 'NO_SUJETO'
          unit_of_measure?: string
          stock?: number
          is_service?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      invoices: {
        Row: {
          id: string
          company_id: string
          dte_type: '01' | '03' | '05' | '06' | '14'
          control_number: string
          generation_code: string
          client_id: string | null
          client_name: string
          client_doc_type: string
          client_doc_number: string
          client_nrc: string | null
          client_email: string | null
          client_phone: string | null
          client_address: string | null
          client_municipality: string | null
          client_department: string | null
          emission_date: string
          emission_time: string
          currency: string
          condition: 'CONTADO' | 'CREDITO'
          credit_term_days: number | null
          payment_method: string
          subtotal_gravado: number
          subtotal_exento: number
          subtotal_no_sujeto: number
          descuento_total: number
          iva13: number
          retencion1: number
          percepcion1: number
          retencion_renta10: number
          total_pagar: number
          total_letras: string
          establishment_code: string
          pos_code: string
          status: 'BORRADOR' | 'TRANSMITIDO' | 'PROCESADO' | 'RECHAZADO' | 'ANULADO'
          mh_reception_stamp: string | null
          mh_response_json: Json | null
          observations: string | null
          created_at: string
        }
      }
    }
  }
}
