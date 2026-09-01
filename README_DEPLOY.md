# Publicación automática de FUL-MAR

El workflow de GitHub Actions está en `.github/workflows/deploy-pages.yml`.
Cada push a `main` instala las dependencias, ejecuta `npm run build` y publica
`dist` en el proyecto de Cloudflare Pages existente `fulmar-instalaciones`.

## Configuración única

1. Crear un repositorio vacío en GitHub y conectar esta carpeta como `origin`.
2. En el repositorio de GitHub, abrir **Settings → Secrets and variables → Actions**
   y crear estos secretos:

   - `CLOUDFLARE_API_TOKEN`: token personalizado de Cloudflare con permiso de
     cuenta **Cloudflare Pages: Edit**.
   - `CLOUDFLARE_ACCOUNT_ID`: Account ID de la cuenta donde existe
     `fulmar-instalaciones`.
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: publishable key del proyecto Supabase.
   - `VITE_EDITOR_EMAIL`: correo técnico autorizado para editar la wiki.
   - `VITE_R2_PUBLIC_BASE_URL`: opcional; completar solo si la aplicación usa
     recursos públicos alojados en R2.

3. Usar `main` como rama principal y hacer el primer push.

Después, **Sync Changes** subirá los commits a `main` y el workflow publicará
automáticamente en la URL actual:
`https://fulmar-instalaciones.pages.dev/`.

El workflow no pasa `--branch`, por lo que publica en producción. Al reutilizar
el mismo proyecto Pages, la URL no cambia.

## Variables locales

Copiar `.env.example` a `.env.local` y completar la publishable key de Supabase
y el correo del editor. `.env.local` está excluido de Git y nunca se publica en
el repositorio.
