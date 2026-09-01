FUL-MAR WIKI COMPLETO - RECUPERACIÓN

Este ZIP SÍ es un proyecto Vite completo. A diferencia del paquete de Biblioteca Masiva, este contiene package.json, index.html, Vite y todo src/.

1) Extraer la carpeta como:
   C:\FULMAR\fulmar-wiki

2) Crear C:\FULMAR\fulmar-wiki\.env.local copiando .env.local.example.

3) Completar:
   VITE_SUPABASE_URL=https://nmhdmqetwtlbfwnabdod.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=tu Publishable key real de Supabase
   VITE_EDITOR_EMAIL=el correo técnico que configuraste para el PIN

4) En CMD:
   cd /d C:\FULMAR\fulmar-wiki
   npm.cmd install
   npm.cmd run dev

5) Abrir la URL que muestre Vite, normalmente http://localhost:5173/

IMPORTANTE:
- NO reemplazar esta carpeta por el paquete FULMAR_Biblioteca_Masiva_Paquete. Ese paquete es solo una extensión/importador.
- Las tablas de Supabase ya creadas no se perdieron al borrar la carpeta local.
- Los datos IVECO/Daily/guías tampoco se perdieron: están en Supabase.
