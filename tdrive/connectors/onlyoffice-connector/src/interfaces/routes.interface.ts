import { Router } from 'express';

export interface Routes {
  path?: string;
  router: Router;
}

export interface OfficeToken {
  user_id: string;
  company_id: string;
  file_id: string;
  file_name: string;
  preview: boolean;
  drive_file_id?: string;
  in_page_token?: boolean;
}
