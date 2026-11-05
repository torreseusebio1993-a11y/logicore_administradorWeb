# LogiCore — Panel de administración

React + Vite + TypeScript + Tailwind. Login con usuario y contraseña (sesión
del backend; nunca la API key de la app móvil).

```bash
cp .env.example .env      # VITE_API_URL=http://127.0.0.1:8000
npm install
npm run dev               # http://localhost:5173
npm run build             # dist/ para producción
```

Crear usuarios (en el backend): `venv/Scripts/python -m app.cli create-user <usuario> "<Nombre>"`

Secciones: Inicio · Cargas (paquetes, editar, borrar, pedir ubicación,
conversación) · Mapa de clientes (Leaflet + OpenStreetMap) · WhatsApp
(cuentas, vincular por QR, límites, mensaje).
