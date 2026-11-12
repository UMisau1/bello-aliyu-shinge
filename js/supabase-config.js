
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://axhoicesbvgdptadinrp.supabase.co";

const SUPABASE_ANON_KEY = "sb_publishable_UQ5O5RgE-hHOpqk-jp-2Lg_lefD4XoH";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
