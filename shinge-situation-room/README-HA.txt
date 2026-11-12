SHINGE MINI SITUATION ROOM – ADD-ON PACKAGE

MUHIMMI:
- Wannan package kari ne (add-on). Ba ya maye gurbin index.html ko tsoffin js files.
- Ka yi backup na project dinka kafin canji.
- An tanadi dashboard din a matsayin sabon folder: situation-room/ (idan za ka kwafe shi cikin babban website folder).
- Yana amfani da Supabase project din da aka riga aka kafa.

ABIN DA YAKE CIKI
1. index.html – Situation Room dashboard
2. js/config.js – Supabase project connection
3. js/app.js – login, LGA monitoring, reports, incidents, daily report, CSV export, audit log
4. sql/01-situation-room-setup.sql – SQL kari; ba ya drop ko clear tsoffin tables.

MATAKI NA 1 – BACKUP
Kwafi babban folder na Shinge-portfolio ka ajiye backup mai suna Shinge-portfolio-BACKUP.

MATAKI NA 2 – KWAFE FILES
Cire ZIP. Kwafi folder din situation-room cikin babban project folder dinka (inda index.html yake). Kada ka goge ko maye gurbin index.html.

MATAKI NA 3 – SUPABASE SQL
1. Shiga Supabase project: axhoicesbvgdptadinrp
2. SQL Editor > New query.
3. Bude sql/01-situation-room-setup.sql, kwafi dukkan SQL, manna a SQL Editor, sannan Run.
4. Wannan SQL yana kirkirar sabbin tables sr_user_profiles, sr_field_reports, sr_incidents, sr_daily_reports, sr_audit_logs; yana kunna RLS.
5. Ba ya goge campaign_reports, campaign_visits, campaign_statistics ko admin_users.

MATAKI NA 4 – ADMIN USER
- Shiga Situation Room da email/password na Supabase Auth admin din da ka riga ka gwada.
- Domin ba wa wani ma'aikaci damar shiga: Supabase Dashboard > Authentication > Users > Add user (email + password). Sai SQL Editor ka yi INSERT cikin public.sr_user_profiles da user UUID, role da LGA dinsa.
- Roles: super_admin, coordinator, data_officer, lga_officer, viewer.
- LGA officer sai an saka masa lga daga LGAs shida. Sauran roles lga = NULL.
- Kada a saka Supabase service_role/secret key cikin browser.

MATAKI NA 5 – GWADAWA
1. Bude local website ta VS Code Live Server.
2. Je /situation-room/ (misali http://127.0.0.1:5500/situation-room/).
3. Shiga da admin email/password.
4. Gwada Field Report, Incident, Refresh da Export CSV.
5. Bayan gwaji, upload sabon folder situation-room/ zuwa GitHub repository. Kada ka sake upload ko overwrite index.html.

MATAKI NA 6 – LINK DAGA CAMPAIGN WEBSITE
Da zarar an gwada, a index.html za a iya saka link din nan a menu:
<a href="situation-room/">Situation Room</a>
Wannan link din zai nuna dashboard; login ne zai hana jama'a ganin bayanan sirri.

LURA:
- Existing campaign_visits, campaign_reports, campaign_statistics da admin_users an karanta su ne kawai inda suka dace. Sabbin incident/report tables suna da prefix sr_ domin kada su rikita tsoffin tsarin.
- PDF: yi amfani da Print > Save as PDF daga browser. Excel: Export CSV (Excel na iya bude CSV).
- GPS coordinates ana karba ne idan jami'i ya bayar da izini/ya danna GPS Check-in. Ba a yin background tracking.
- Kafin amfani da ainihin bayanan mutane, tabbatar da izini, privacy notice, access control da backup.
