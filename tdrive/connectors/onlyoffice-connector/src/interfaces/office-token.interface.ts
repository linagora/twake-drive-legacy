export interface OfficeToken {
  user_id: string;
  company_id: string;
  file_id: string;
  file_name: string;
  preview: boolean;
  editing_session_key: string;
  drive_file_id?: string;
  in_page_token?: boolean;
}
