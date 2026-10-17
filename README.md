# Consultorio — app de gestión para psicólogos

MVP de una app SaaS para psicólogos independientes: agenda, notas de evolución, control de cobros y recordatorios por WhatsApp.

## Cómo probarla

Abrí `app/index.html` (página de ventas) o `app/app.html` (la app) en el navegador. No necesita instalación.
En **Ajustes → Cargar datos de ejemplo** podés ver cómo se ve con pacientes cargados.

> ⚠️ Es una demo: los datos se guardan solo en el navegador (localStorage). No usar con datos reales de pacientes hasta tener backend seguro (ver "Próximos pasos").

## Qué incluye

- **Inicio**: cobrado del mes, pendiente de cobro, sesiones y pacientes activos.
- **Agenda**: sesiones presenciales/online con estados (programada, realizada, cancelada, ausente).
- **Pacientes**: ficha, motivo de consulta, honorario, deuda y evolución sesión por sesión.
- **Cobros**: sesiones impagas y reporte de ingresos por mes (plan Pro).
- **Recordatorio por WhatsApp** con mensaje prearmado (plan Pro).
- **Backup**: exportar/importar JSON.
- **Plan gratis vs. Pro**: límite de 5 pacientes activos en el gratuito (el "upgrade" está simulado).

## Modelo de negocio

**Por qué para psicólogos y no para pacientes:** el profesional paga porque la herramienta le ahorra tiempo y le ayuda a cobrar; las apps de bienestar para el público general compiten con gigantes y tienen mucho abandono.

| Plan | Precio sugerido | Para quién |
|---|---|---|
| Gratis | $0 | Hasta 5 pacientes — gancho para probar |
| Profesional | USD 9/mes (o ~equivalente en ARS) | Psicólogo independiente |
| Centro / Equipo | USD 25/mes | Consultorios con varios profesionales |

**Números de referencia:** 200 profesionales × USD 9 ≈ USD 1.800/mes recurrentes.

**Ingresos extra posibles:** cobro online de sesiones con comisión (Mercado Pago), videollamada integrada, recordatorios automáticos, emisión de factura electrónica (AFIP/ARCA).

## Cómo validarlo antes de invertir más

1. Mostrale la demo a 10–20 psicólogos (colegas, grupos de Facebook/WhatsApp, colegios de psicólogos).
2. Preguntá: ¿cómo manejás hoy la agenda y los cobros? ¿Pagarías USD 9/mes por esto?
3. Conseguí 5 que se comprometan a pagar (preventa) antes de construir el backend.

## Próximos pasos técnicos

1. **Backend + login** (ej. Supabase o Firebase) con datos cifrados, para usarla desde el celular y la compu.
2. **Pagos de suscripción**: Mercado Pago (Argentina/LatAm) o Stripe.
3. **Recordatorios automáticos** por WhatsApp Business API / email.
4. **App móvil** (PWA primero, es más barato que una app nativa).

## Legal y privacidad (importante)

Se manejan datos de salud, que son datos sensibles. Antes de lanzar con datos reales:
- Argentina: Ley 25.326 (Protección de Datos Personales) y Ley 26.529 (Derechos del Paciente / historia clínica).
- Si vendés afuera: GDPR (Europa), HIPAA (EE. UU.).
- Términos y condiciones, política de privacidad, cifrado y backups. Conviene consultarlo con un abogado.
