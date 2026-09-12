# CCTV Field Tools

Herramientas de campo para técnicos instaladores de CCTV.

## URL producción
https://cctv-field-tools.vercel.app

## Características
- Calculadora de subredes IP
- Estimador de almacenamiento / ancho de banda
- Pinout RJ45 T568A/T568B + guía BNC
- Checklist DVR/NVR (19 ítems)
- Simulador Ping + Test RTSP
- Checklist de instalación → historial
- Exportar PDF
- Auth email + Google (local o Supabase)
- Modo offline (PWA)
- Sync automática con conflictos LWW

## Activar Supabase
1. Crea proyecto en supabase.com
2. Ejecuta el SQL de la tabla `installations`
3. Pega URL y anon key en `js/config.js`
