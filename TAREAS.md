# Tareas - PencaViva

> Archivo de seguimiento de tareas para Claude Code.
> Actualizar este archivo cada vez que se complete, inicie o modifique una tarea.
>
> **Metodologia**: TDD obligatorio (skill `/tdd`) - RED-GREEN-REFACTOR en vertical slices.

## Leyenda

- `[ ]` Pendiente
- `[~]` En progreso
- `[x]` Completado
- `[-]` Cancelado / No aplica

---

## Fase 0: Setup del Proyecto (Semana 1)

> **Estado**: EN PROGRESO
> **Estimacion**: ~17h

### Infraestructura

- [x] **F0-01** Inicializar proyecto Expo SDK 55 con TypeScript
  - Criterio: Proyecto corriendo en simulador
  - Esfuerzo: 2h
  - Notas: Upgraded from SDK 53 to SDK 55 (RN 0.83.2, React 19.2.0, Reanimated 4.2.x, TS 5.9.x). tsconfig strict mode + path aliases (@/\*, @components/\*, etc.). New Architecture es default en SDK 55 (newArchEnabled eliminado de ExpoConfig). react-native-worklets requerido como peer dep de Reanimated v4.

- [ ] **F0-02** Configurar Supabase (proyecto + auth providers)
  - Criterio: Proyecto Supabase creado, Google y Apple auth configurados
  - Esfuerzo: 2h

- [x] **F0-03** Configurar ESLint + Prettier
  - Criterio: Linting automatico funcionando
  - Esfuerzo: 1h
  - Notas: ESLint 8 + @typescript-eslint + prettier plugin. Husky v9 pre-commit hook ejecuta format:check + lint.

- [x] **F0-04** Crear estructura de carpetas (feature-based)
  - Criterio: Estructura `app/`, `src/components/`, `src/hooks/`, `src/lib/`, etc.
  - Esfuerzo: 1h
  - Notas: Estructura base creada. Carpetas se iran poblando en fases siguientes.

- [x] **F0-05** Configurar NativeWind v5 + Tailwind CSS v4
  - Criterio: Estilos Tailwind funcionando en componentes RN
  - Notas: metro.config.js con `withNativewind()` (sin segundo argumento en v5). NativeWind v5.0.0-preview.2 + Tailwind CSS v4.2.1. postcss.config.mjs requerido. nativewind-env.d.ts para tipos TypeScript. global.css importado en app/\_layout.tsx. Requiere react-native-css@3.0.3 que necesita @expo/metro-config >= 54 (resuelto con SDK 55).
  - Esfuerzo: 2h

- [x] **F0-06** Setup de navegacion (Expo Router v4)
  - Criterio: Tab navigation basica con 5 tabs (Home, Predecir, Ranking, Grupos, Perfil)
  - Esfuerzo: 3h
  - Notas: Expo Router v5.1.11 (SDK 53). Ionicons para tab icons (outline/filled). (tabs) con 5 tabs + groups/ nested Stack. (auth) con Stack (welcome, login, complete-profile). match/[id] dynamic route. app/index.tsx con Redirect a /(tabs). SafeAreaView en todas las pantallas. Jest mocks para expo-router y @expo/vector-icons. Path aliases en jest.config.js. Type declaration para @expo/vector-icons.

- [ ] **F0-07** Crear esquema de BD (migrations SQL)
  - Criterio: Todas las tablas creadas con RLS policies activas
  - Tablas: profiles, tournaments, matches, groups, group_members, group_tournaments, predictions, leaderboard_cache, notifications
  - Esfuerzo: 4h

- [x] **F0-08** Configurar EAS Build + EAS Update
  - Criterio: Build de desarrollo funcional
  - Esfuerzo: 2h
  - Notas: eas.json con 3 perfiles (development, staging, production). CD workflows configurados para EAS Update por channel.

- [x] **F0-11** Configurar CI/CD y repo GitHub
  - Criterio: GitHub Actions CI/CD funcional, branch protection, environments
  - Esfuerzo: 4h
  - Notas: CI (4 jobs paralelos: lint, typecheck, test, expo doctor). CD (develop, staging, production). semantic-release en main. Dependabot configurado. Branch protection en main y develop. Environments: development, staging, production (prod con approval manual). commitlint + Conventional Commits.

### Setup de Testing (TDD)

- [x] **F0-09** Configurar framework de testing (Jest + React Native Testing Library)
  - Criterio: Un test dummy pasa con `npm test`
  - Esfuerzo: 2h
  - Notas: jest-expo preset. Usar jest.config.js (no .ts, evita dependencia de ts-node).

- [ ] **F0-10** Configurar testing de funciones SQL/Supabase
  - Criterio: Tests pueden ejecutar queries contra Supabase (local o test project)
  - Esfuerzo: 2h

---

## Fase 1: MVP Core (Semanas 2-5)

> **Estado**: NO INICIADA
> **Estimacion**: ~111h

### Milestone 1: Auth + Perfil (Semana 2)

- [ ] **F1-01** Pantalla de Welcome/Onboarding
  - 3 pantallas con animaciones introductorias
  - Depends: F0-06 (navegacion)
  - Esfuerzo: 4h

- [ ] **F1-02** Implementar Google Sign-In
  - Login con Google via Supabase Auth
  - Depends: F0-02 (Supabase)
  - Esfuerzo: 4h

- [ ] **F1-03** Implementar Apple Sign-In
  - Login con Apple via Supabase Auth (requerido por App Store)
  - Depends: F0-02 (Supabase)
  - Esfuerzo: 4h

- [ ] **F1-04** Pantalla de completar perfil (username, avatar)
  - Validacion de unicidad de username en tiempo real
  - Upload de avatar (o usar default generado)
  - Seleccion de equipo favorito (opcional)
  - Depends: F1-02 o F1-03 (auth funcional)
  - Esfuerzo: 6h

- [ ] **F1-05** Trigger de creacion de perfil automatico
  - Database trigger: al crear usuario en auth.users -> insertar en profiles
  - Depends: F0-07 (esquema BD)
  - Esfuerzo: 2h

- [ ] **F1-06** Pantalla de perfil (ver/editar)
  - Ver stats, editar display_name, avatar, bio, equipo favorito
  - Depends: F1-04 (perfil completo)
  - Esfuerzo: 4h

- [ ] **F1-07** Autenticacion biometrica (Face ID / Huella)
  - expo-local-authentication para re-autenticacion rapida
  - Prompt biometrico al abrir la app (si habilitado)
  - Fallback a login manual
  - Depends: F1-02/F1-03 (auth), expo-secure-store
  - Esfuerzo: 4h

- [ ] **F1-08** Configuracion de biometria en Settings
  - Toggle activar/desactivar
  - Selector de tiempo de gracia (1min, 5min, 15min, siempre)
  - Depends: F1-07 (biometria)
  - Esfuerzo: 2h

### Milestone 2: Grupos (Semana 3)

- [ ] **F1-09** Pantalla "Mis Grupos" (lista)
  - Lista de grupos del usuario con avatar, nombre, miembros
  - Depends: F1-02/F1-03 (auth)
  - Esfuerzo: 4h

- [ ] **F1-10** Crear grupo (form + scoring setup)
  - Nombre, descripcion, seleccion de torneos, sistema de puntuacion (presets o custom)
  - Limite de miembros (default 50)
  - Depends: F0-07 (BD)
  - Esfuerzo: 6h

- [ ] **F1-11** Generar codigo de invitacion + QR
  - Codigo unico de 8 caracteres
  - QR generado en la app
  - Compartir por redes sociales
  - Depends: F1-10 (crear grupo)
  - Esfuerzo: 3h

- [ ] **F1-12** Unirse a grupo (por codigo)
  - Input de codigo de 8 caracteres
  - Validacion de que el grupo existe y tiene espacio
  - Depends: F0-07 (BD)
  - Esfuerzo: 4h

- [ ] **F1-13** Deep link para invitaciones
  - `pencaviva://join/ABC12345` o link universal
  - Depends: F0-06 (Expo Router)
  - Esfuerzo: 3h

- [ ] **F1-14** Detalle del grupo (miembros, info)
  - Lista de miembros con roles
  - Info del grupo, torneos asignados
  - Depends: F1-09 (lista grupos)
  - Esfuerzo: 4h

- [ ] **F1-15** Asignar torneos a grupo
  - Multi-select de torneos disponibles
  - Depends: F0-07 (BD con tabla tournaments)
  - Esfuerzo: 3h

### Milestone 3: Predicciones (Semana 4)

- [ ] **F1-16** Sync de partidos (Edge Function + API-Football)
  - Edge Function `match-sync`: cron 24h para fixtures, 1min para live
  - Mapeo de datos API-Football -> tabla matches
  - Depends: F0-07 (BD), API key de API-Football
  - Esfuerzo: 8h

- [ ] **F1-17** Pantalla de predicciones (lista de partidos)
  - Cards por partido con logos, equipos, hora
  - Scroll por fecha/jornada
  - Indicador de estado (pendiente, hecha, cerrada)
  - Depends: F1-16 (matches)
  - Esfuerzo: 6h

- [ ] **F1-18** Input de prediccion (stepper numerico)
  - Stepper (+/-) o teclado numerico para home_score y away_score
  - Confirmacion visual (animacion + haptic)
  - Depends: F1-17 (pantalla predicciones)
  - Esfuerzo: 4h

- [ ] **F1-19** Guardar predicciones (con validacion de horario)
  - RLS bloquea predicciones post-kickoff (server-side)
  - UI deshabilita inputs post-kickoff (client-side)
  - Optimistic UI con rollback en error
  - Depends: F0-07 (RLS policies)
  - Esfuerzo: 4h

- [ ] **F1-20** Ver predicciones de otros (post-kickoff)
  - Solo visibles despues del kickoff (RLS)
  - Vista de predicciones del grupo por partido
  - Depends: F0-07 (RLS policies)
  - Esfuerzo: 3h

- [ ] **F1-21** Calculo de puntos (DB function)
  - Funcion `calculate_prediction_points()` en PostgreSQL
  - Scoring: exacto (5pts), resultado correcto (3pts), diff goles (1pt bonus)
  - Configurable por grupo via JSONB
  - Depends: F0-07 (BD)
  - Esfuerzo: 4h

- [ ] **F1-22** Trigger de actualizacion de leaderboard
  - Trigger `process_match_result()` al cambiar match a 'finished'
  - Actualiza predictions.points + refresh leaderboard_cache
  - Depends: F1-21 (calculo puntos)
  - Esfuerzo: 3h

### Milestone 4: Leaderboard (Semana 5)

- [ ] **F1-23** Pantalla de ranking (lista ordenada)
  - Top 3 destacado (oro, plata, bronce)
  - Mi posicion sticky si fuera del viewport
  - Stats por jugador (partidos, exactos, aciertos)
  - Depends: F1-22 (leaderboard cache)
  - Esfuerzo: 6h

- [ ] **F1-24** Suscripcion Realtime al leaderboard
  - Supabase Realtime: `postgres_changes` en leaderboard_cache
  - Actualizar UI en tiempo real al procesar resultados
  - Depends: Supabase Realtime configurado
  - Esfuerzo: 4h

- [ ] **F1-25** Filtros (General / Fecha / Ultimos N)
  - Tab bar: General | Por Fecha | Tendencia
  - Queries diferentes para cada vista
  - Depends: F1-23 (ranking)
  - Esfuerzo: 4h

- [ ] **F1-26** Destacar mi posicion
  - Resaltar la fila del usuario actual
  - Indicador de cambio de posicion (flecha verde/roja)
  - Depends: F1-23 (ranking)
  - Esfuerzo: 2h

- [ ] **F1-27** Animaciones de cambio de posicion
  - Slide up/down con glow verde/rojo
  - React Native Reanimated para animaciones 60fps
  - Depends: F1-24 (realtime), Reanimated
  - Esfuerzo: 3h

- [ ] **F1-28** Stats detalladas por jugador
  - Pantalla de detalle: historial de predicciones, aciertos, rachas
  - Depends: F1-23 (ranking)
  - Esfuerzo: 4h

---

## Fase 2: Polish + Notifications (Semanas 6-7)

> **Estado**: NO INICIADA
> **Estimacion**: ~41h

### Push Notifications

- [ ] **F2-01** Push notifications setup (Expo)
  - Configurar expo-notifications
  - Registrar push tokens en profiles.push_token
  - Depends: F1-02/F1-03 (auth)
  - Esfuerzo: 4h

- [ ] **F2-02** Recordatorio de prediccion (Edge Function cron)
  - Edge Function con cron: 2h y 30min antes del kickoff
  - Depends: F2-01 (push setup), F1-16 (matches)
  - Esfuerzo: 4h

- [ ] **F2-03** Notificacion de resultado disponible
  - Disparar al finalizar partido y calcular puntos
  - Depends: F1-22 (trigger calculo)
  - Esfuerzo: 3h

- [ ] **F2-04** Notificacion de cambio de ranking
  - Notificar cuando el usuario sube/baja posiciones
  - Depends: F1-22 (leaderboard update)
  - Esfuerzo: 3h

- [ ] **F2-05** Pantalla de notificaciones (inbox)
  - Lista de notificaciones con read/unread
  - Marcar como leida
  - Deep link a la pantalla relevante
  - Depends: F0-07 (tabla notifications)
  - Esfuerzo: 4h

- [ ] **F2-06** Configuracion de notificaciones (toggles)
  - Toggle por tipo: recordatorios, resultados, ranking, invitaciones
  - Modo silencioso por horario
  - Depends: F2-01 (push setup)
  - Esfuerzo: 3h

### UX Polish

- [ ] **F2-07** Pull to refresh en todas las pantallas
  - Esfuerzo: 2h

- [ ] **F2-08** Loading states + skeletons
  - Skeleton screens para listas (partidos, ranking, grupos)
  - Esfuerzo: 4h

- [ ] **F2-09** Error handling global
  - Error boundaries, toast messages, retry logic
  - Esfuerzo: 3h

- [ ] **F2-10** Animaciones y micro-interacciones
  - Confetti al guardar prediccion
  - Estrella dorada en resultado exacto
  - Pelota rebotando en pull-to-refresh
  - Pulso rojo en partidos LIVE
  - Esfuerzo: 6h

- [ ] **F2-11** Dark mode + Light mode toggle
  - NativeWind dark: variant
  - Persistir preferencia en AsyncStorage
  - Esfuerzo: 3h

- [ ] **F2-12** Haptic feedback en acciones clave
  - Guardar prediccion, resultado exacto, cambio ranking
  - Esfuerzo: 2h

---

## Fase 3: Testing + Beta (Semanas 8-9)

> **Estado**: NO INICIADA
> **Estimacion**: ~42h
> **Nota**: TDD se aplica durante todo el desarrollo (Fases 0-2).
> Esta fase es para tests E2E, performance y beta testing.

- [ ] **F3-01** Test E2E de flujo completo
  - Registro -> crear grupo -> predecir -> ver resultado -> ranking
  - Esfuerzo: 6h

- [ ] **F3-02** Test de RLS policies
  - Verificar que no se puede predecir post-kickoff
  - Verificar visibilidad de predicciones ajenas
  - Verificar permisos de grupo (admin/member)
  - Esfuerzo: 4h

- [ ] **F3-03** Test de Edge Functions
  - match-sync, calculate-scores, send-notification
  - Esfuerzo: 3h

- [ ] **F3-04** Performance profiling (render times)
  - Medir tiempos de render en listas largas
  - Optimizar re-renders innecesarios
  - Esfuerzo: 3h

- [ ] **F3-05** Beta testing con 10-20 amigos
  - Build de produccion via EAS
  - Distribuir via TestFlight (iOS) + Internal Testing (Android)
  - Recopilar feedback
  - Esfuerzo: 8h

- [ ] **F3-06** Fix bugs reportados
  - Priorizar por severidad
  - Esfuerzo: 12h

- [ ] **F3-07** Optimizacion de queries lentas
  - Analizar con EXPLAIN ANALYZE
  - Agregar indices faltantes
  - Esfuerzo: 4h

- [ ] **F3-08** Setup de Sentry para crash reporting
  - Integrar @sentry/react-native
  - Configurar source maps
  - Esfuerzo: 2h

---

## Fase 4: Launch (Semana 10)

> **Estado**: NO INICIADA
> **Estimacion**: ~16h

- [ ] **F4-01** App Store assets (screenshots, descripcion)
  - Screenshots para iPhone y iPad
  - Descripcion en espanol
  - Keywords optimizadas
  - Esfuerzo: 4h

- [ ] **F4-02** Privacy policy + Terms of service
  - Esfuerzo: 3h

- [ ] **F4-03** Submit a App Store (iOS)
  - Esfuerzo: 2h

- [ ] **F4-04** Submit a Play Store (Android)
  - Esfuerzo: 2h

- [ ] **F4-05** Configurar EAS Update para OTA
  - Canal de produccion, staging
  - Esfuerzo: 1h

- [ ] **F4-06** Landing page simple (opcional)
  - Esfuerzo: 4h

- [ ] **F4-07** Monitoreo post-lanzamiento
  - Dashboards de Sentry + Expo Insights
  - Ongoing

---

## Fases Futuras (Post-Launch)

> Estas fases se planificaran en detalle cuando se acerquen.
> Se incluyen como referencia de alto nivel.

### Fase 5: Social (Semanas 11-14)

- [ ] **F5-01** Chat en grupo (Supabase Realtime Broadcast)
- [ ] **F5-02** Reacciones a predicciones de otros
- [ ] **F5-03** Compartir resultados en redes sociales (imagen generada)
- [ ] **F5-04** Sistema de amigos / followers
- [ ] **F5-05** Feed de actividad social

### Fase 6: Gamification (Semanas 15-18)

- [ ] **F6-01** Sistema de badges/logros
- [ ] **F6-02** Niveles de usuario (basado en participacion)
- [ ] **F6-03** Prediccion de la semana
- [ ] **F6-04** Streaks (rachas de aciertos)
- [ ] **F6-05** Desafios 1vs1 entre amigos

### Fase 7: Expansion (Semanas 19+)

- [ ] **F7-01** Grupos publicos con torneos oficiales
- [ ] **F7-02** Multi-deporte (basquetbol, tenis, etc.)
- [ ] **F7-03** Predicciones especiales (goleador, tarjetas, etc.)
- [ ] **F7-04** Ligas entre grupos (meta-competencia)
- [ ] **F7-05** Monetizacion: Premium (temas, stats avanzadas, sin ads)
- [ ] **F7-06** Widgets nativos iOS/Android

---

## Resumen de Progreso

| Fase             | Tareas | Completadas | En Progreso | Pendientes |
| ---------------- | ------ | ----------- | ----------- | ---------- |
| Fase 0: Setup    | 11     | 7           | 0           | 4          |
| Fase 1: MVP Core | 28     | 0           | 0           | 28         |
| Fase 2: Polish   | 12     | 0           | 0           | 12         |
| Fase 3: Testing  | 8      | 0           | 0           | 8          |
| Fase 4: Launch   | 7      | 0           | 0           | 7          |
| **Total MVP**    | **66** | **7**       | **0**       | **59**     |
| Fase 5-7: Futuro | 16     | 0           | 0           | 16         |

**Progreso general MVP: 10.6%**

---

## Instrucciones para Claude Code

1. **Antes de empezar una tarea**: Marcarla como `[~]` (en progreso)
2. **Al completar una tarea**: Marcarla como `[x]` y actualizar la tabla de resumen
3. **Si una tarea se cancela**: Marcarla como `[-]` con una nota explicando por que
4. **Si surgen tareas nuevas**: Agregarlas con el siguiente ID disponible en la fase correspondiente
5. **TDD obligatorio**: Seguir `/tdd` para cada tarea de codigo (RED-GREEN-REFACTOR vertical)
6. **Dependencias**: No iniciar una tarea si sus dependencias no estan completadas
7. **Notas**: Agregar notas relevantes debajo de cada tarea si hay decisiones importantes o problemas encontrados

### Orden recomendado de ejecucion

```
Fase 0 (secuencial):
F0-01 ✅ → F0-03 ✅ → F0-04 ✅ → F0-05 ✅ → F0-06 → F0-09 ✅ (setup testing)
F0-02 → F0-07 → F0-10 (setup Supabase + BD testing)
F0-08 ✅ + F0-11 ✅ (EAS + CI/CD, completados juntos)

Fase 1 - Milestone 1 (secuencial con paralelo parcial):
F1-05 → F1-02 + F1-03 (paralelo) → F1-04 → F1-06
F1-07 → F1-08

Fase 1 - Milestone 2:
F1-09 → F1-10 → F1-11
F1-12, F1-13 (paralelo)
F1-14 → F1-15

Fase 1 - Milestone 3:
F1-16 → F1-17 → F1-18 → F1-19
F1-20 (independiente post-kickoff logic)
F1-21 → F1-22

Fase 1 - Milestone 4:
F1-23 → F1-24 → F1-25 + F1-26 (paralelo) → F1-27
F1-28 (independiente)
```
