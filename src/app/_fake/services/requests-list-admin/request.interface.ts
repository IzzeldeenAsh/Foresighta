export interface RequestResponse {
    data: RequestItem[];
    links: Links;
    meta: Meta;
  }
  
  export interface RequestItem {
    id: number;
    type: {
      key: string;
      label: string;
    };
    requestable_type: string;
    requestable: Requestable;
    comments?: string;
    staff_notes?: string;
    status: string;
    final_status: string;
    children?: RequestItem[];
    handel_by?: string;
    handel_at?: string;
  }
  
  export interface Requestable {
    id: number;
    legal_name?: string;
    name?: string;
    logo?: string;
    website?: string;
    verified_email?: string;
    company_phone?: string;
    address?: string;
    about_us?: string;
    register_document?: string;
    status?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    country?: string;
    bio?: string;
    profile_photo_url?: string;
    insighter_status?: string;
    company_status?: string;
  }
  
  export interface Links {
    first: string;
    last: string;
    prev: string | null;
    next: string | null;
  }
  
  export interface Meta {
    current_page: number;
    from: number;
    last_page: number;
    links: MetaLink[];
    path: string;
    per_page: number;
    to: number;
    total: number;
  }
  
  export interface MetaLink {
    url: string | null;
    label: string;
    active: boolean;
  }
  