# Plan Maestro: PencaViva

## Pronósticos Deportivos Sociales entre Amigos

**Versión**: 1.1
**Fecha**: 23 de febrero de 2026
**Tipo**: App social de pronósticos (sin apuestas de dinero real)
**Mercado objetivo**: Uruguay (expandible a Latinoamérica)

---

## Tabla de Contenidos

1. [Visión del Producto](#1-visión-del-producto)
2. [Arquitectura Técnica](#2-arquitectura-técnica)
3. [Modelo de Datos](#3-modelo-de-datos)
4. [Módulos de la App](#4-módulos-de-la-app)
5. [UX/UI](#5-uxui)
6. [Integraciones](#6-integraciones)
7. [Roadmap de Implementación](#7-roadmap-de-implementación)
8. [Riesgos y Mitigación](#8-riesgos-y-mitigación)
9. [Métricas de Éxito](#9-métricas-de-éxito)

---

## 1. Visión del Producto

### Problema

Las apps de pencas existentes en Uruguay (Penca Ovación, etc.) tienen UX desactualizada, poca interacción social, y funcionalidades limitadas. Los usuarios terminan usando grupos de WhatsApp para organizar pencas, lo cual es caótico y propenso a errores.

### Solución

Una app moderna, social-first, que haga de las pencas una experiencia divertida, competitiva y fácil de compartir. No es una app de apuestas — es una red social deportiva centrada en pronósticos.

### Propuesta de Valor Diferencial

| Característica  | Penca Ovación        | Nuestra App                                                   |
| --------------- | -------------------- | ------------------------------------------------------------- |
| UX/UI           | Anticuada, web-first | Mobile-first, dark mode, micro-interacciones                  |
| Social          | Básico               | Chat en grupo, reacciones, compartir predicciones             |
| Notificaciones  | Email/básicas        | Push inteligentes (recordatorios, actualizaciones de ranking) |
| Personalización | Limitada             | Avatares, badges, temas de ligas                              |
| Performance     | Lenta                | Tiempo real, optimistic UI                                    |
| Torneos         | Solo fútbol local    | Multi-deporte, torneos personalizados                         |

### Criterios de Éxito

- Lanzar MVP en 10 semanas
- 500 usuarios activos en el primer mes post-lanzamiento
- Retención D7 > 40%
- Rating App Store/Play Store > 4.5

---

## 2. Arquitectura Técnica

### 2.1 Stack Seleccionado

```
┌──────────────────────────────────────────────────────┐
│                   FRONTEND                            │
│  React Native 0.83 + Expo SDK 55 + React 19.2        │
│  ├── Expo Router v4 (navegación + deep linking)       │
│  ├── expo-notifications (push)                        │
│  ├── @supabase/supabase-js v2.x (datos + auth + RT)  │
│  ├── @tanstack/react-query v5.x (cache + sync)       │
│  ├── Zustand v5.x (estado global ligero)              │
│  ├── React Native Reanimated v4.x (animaciones)      │
│  ├── NativeWind v5 + Tailwind CSS v4 (estilos)       │
│  └── EAS Build + EAS Update (CI/CD + OTA)             │
└──────────────────────┬───────────────────────────────┘
                       │ HTTPS + WebSocket
┌──────────────────────▼───────────────────────────────┐
│                   BACKEND                             │
│  Supabase (hosted)                                    │
│  ├── PostgreSQL 15+ (base de datos relacional)        │
│  ├── Auth (Google, Apple Sign-In, email)              │
│  ├── Realtime (leaderboards en vivo)                  │
│  ├── Edge Functions (Deno)                            │
│  │   ├── score-calculator (cálculo de puntos)         │
│  │   ├── match-sync (sincronización con API)          │
│  │   ├── push-sender (envío de notificaciones)        │
│  │   └── cron-jobs (tareas programadas)               │
│  ├── Storage (avatares, imágenes de ligas)            │
│  └── Row Level Security (seguridad por fila)          │
└──────────────────────┬───────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────┐
│              SERVICIOS EXTERNOS                       │
│  ├── API-Football (datos de partidos y resultados)    │
│  ├── Expo Push Service (notificaciones push)          │
│  └── Sentry (monitoreo de errores)                    │
└──────────────────────────────────────────────────────┘
```

### 2.2 Justificación del Stack

#### React Native + Expo (Frontend)

**Por qué Expo y no RN bare workflow:**

- **Expo SDK 55 con New Architecture** habilitada por defecto (Fabric + TurboModules) — rendimiento nativo sin configuración
- **Expo Router v4** — navegación basada en archivos con deep linking automático (cada ruta = un deep link)
- **EAS Update** — actualizaciones OTA instantáneas sin pasar por App Store (crítico para corregir bugs de puntaje durante torneos en vivo)
- **EAS Build** — CI/CD en la nube, builds para iOS sin Mac
- **expo-notifications** — API unificada para push en iOS y Android
- **Desarrollo rápido** — un solo desarrollador puede hacer deploy a ambas plataformas

**Versiones exactas del stack (verificadas via Context7, febrero 2026):**

| Librería                    | Versión                     | Propósito                                                  |
| --------------------------- | --------------------------- | ---------------------------------------------------------- |
| `expo`                      | **SDK 55**                  | Framework base (incluye React Native 0.83, React 19.2)     |
| `react-native`              | **0.83**                    | Runtime mobile (incluido con Expo SDK 55)                  |
| `react`                     | **19.2.0**                  | UI library (incluido con Expo SDK 55)                      |
| `expo-router`               | **v4** (incluido en SDK 55) | Navegación file-based + deep linking automático            |
| `@supabase/supabase-js`     | **^2.58.0**                 | Cliente Supabase (queries, auth, realtime)                 |
| `@tanstack/react-query`     | **^5.84.1**                 | Cache de datos, invalidación, sync en background           |
| `zustand`                   | **^5.0.8**                  | Estado global minimalista (requiere React 18+)             |
| `react-native-reanimated`   | **^4.1.5**                  | Animaciones 60fps (requiere New Architecture)              |
| `nativewind`                | **v5 (preview)**            | Tailwind CSS v4 para React Native                          |
| `tailwindcss`               | **v4**                      | Motor de estilos utility-first (peer dep de NativeWind v5) |
| `react-native-css`          | **(peer dep)**              | Requerido por NativeWind v5                                |
| `expo-image`                | **(incluido en SDK 55)**    | Carga optimizada de imágenes (avatares, logos)             |
| `expo-secure-store`         | **(incluido en SDK 55)**    | Almacenamiento seguro de tokens                            |
| `expo-notifications`        | **(incluido en SDK 55)**    | Push notifications iOS + Android                           |
| `expo-local-authentication` | **(incluido en SDK 55)**    | Biometría: Face ID, Touch ID, huella dactilar              |
| `date-fns`                  | **^3.5.0**                  | Manejo de fechas                                           |
| `@date-fns/tz`              | **latest**                  | Zonas horarias con TZDate (reemplaza date-fns-tz)          |
| `react-native-web`          | **0.21.0**                  | Soporte web (incluido con Expo SDK 55)                     |
| `typescript`                | **^5.x**                    | Tipado estático                                            |
| Node.js (dev)               | **>= 20.19.x**              | Requerido por Expo SDK 55                                  |

**Notas de compatibilidad importantes:**

- **Reanimated 4.x requiere New Architecture** (habilitada por defecto en Expo SDK 55). No es compatible con Old Architecture.
- **Zustand v5 requiere React 18+** y `use-sync-external-store` como peer dependency para custom equality functions.
- **NativeWind v5 está en preview** pero es funcional. Usa Tailwind CSS v4 (no v3). La config de Metro cambió: ya no necesita segundo argumento en `withNativewind()`.
- **@date-fns/tz reemplaza date-fns-tz** — usa `TZDate` class en lugar del viejo `utcToZonedTime`. Tamaño: 916B (TZDateMini) / 1.2KB (TZDate).
- **@supabase/supabase-js requiere Node.js 20+** en dev (Node 18 fue dropeado).

#### Supabase (Backend)

**Por qué Supabase y no Firebase:**

1. **Datos relacionales** — Las pencas son inherentemente relacionales: usuarios ↔ grupos ↔ torneos ↔ partidos ↔ predicciones. PostgreSQL maneja esto naturalmente con JOINs y agregaciones. Firestore requeriría desnormalización masiva.

2. **Leaderboards con SQL** — Calcular rankings es trivial en SQL:

   ```sql
   SELECT u.id, u.display_name, u.avatar_url,
          SUM(p.points) as total_points,
          RANK() OVER (ORDER BY SUM(p.points) DESC) as position
   FROM predictions p
   JOIN users u ON p.user_id = u.id
   WHERE p.group_id = $1 AND p.tournament_id = $2
   GROUP BY u.id
   ORDER BY total_points DESC;
   ```

   En Firestore necesitarías Cloud Functions + colecciones desnormalizadas + sincronización manual.

3. **Costo predecible** — $25/mes (Pro) vs pricing por lectura/escritura de Firestore que puede explotar con leaderboards que generan muchas lecturas.

4. **RLS (Row Level Security)** — Las reglas de seguridad se escriben en SQL directamente en la base de datos. Ejemplo: "un usuario solo puede editar sus predicciones antes de que empiece el partido":

   ```sql
   CREATE POLICY "Users can update own predictions before match"
   ON predictions FOR UPDATE
   USING (auth.uid() = user_id)
   WITH CHECK (
     auth.uid() = user_id AND
     (SELECT kickoff_time FROM matches WHERE id = match_id) > now()
   );
   ```

5. **Sin vendor lock-in** — PostgreSQL es portable. Si algún día necesitas migrar, tus datos y esquema se mueven fácilmente.

6. **Open Source** — Puedes self-hostear si necesitas control total.

**Gap de Push Notifications:**
Supabase no tiene servicio de push nativo, pero esto se resuelve fácilmente con **Expo Push Service** (gratuito, integrado con Expo). Las Edge Functions de Supabase llaman a la API de Expo Push para enviar notificaciones.

### 2.3 Limites del Free Tier de Supabase

| Recurso        | Free                        | Pro ($25/mes)               |
| -------------- | --------------------------- | --------------------------- |
| Base de datos  | 500 MB                      | 8 GB                        |
| Auth MAUs      | 50,000                      | 100,000                     |
| Storage        | 1 GB                        | 100 GB                      |
| Realtime       | 200 conexiones, 2M msgs/mes | 500 conexiones, 5M msgs/mes |
| Edge Functions | 500K invocaciones/mes       | 2M invocaciones/mes         |
| Bandwidth      | 5 GB                        | 250 GB                      |

**Para el MVP, el Free Tier es más que suficiente.** Para producción con ~5,000 usuarios activos, el Pro a $25/mes cubre todo holgadamente.

---

## 3. Modelo de Datos

### 3.1 Diagrama Entidad-Relación

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   profiles   │     │   groups          │     │ tournaments  │
│─────────────│     │──────────────────│     │─────────────│
│ id (FK auth) │◄──┐│ id               │     │ id           │
│ display_name │   ││ name             │     │ name         │
│ avatar_url   │   ││ description      │     │ sport        │
│ push_token   │   ││ invite_code      │     │ country      │
│ created_at   │   ││ avatar_url       │     │ season       │
│ updated_at   │   ││ scoring_system   │     │ api_league_id│
└──────────────┘   ││ created_by (FK)  │     │ status       │
                   ││ max_members      │     │ start_date   │
                   ││ created_at       │     │ end_date     │
                   │└──────────────────┘     └──────┬──────┘
                   │         │                       │
                   │         │ N:N                   │ 1:N
                   │         ▼                       ▼
                   │┌─────────────────┐     ┌──────────────┐
                   ││  group_members   │     │   matches     │
                   ││─────────────────│     │──────────────│
                   │├ group_id (FK)   │     │ id            │
                   └┤ user_id (FK)    │     │ tournament_id │
                    │ role            │     │ home_team     │
                    │ joined_at       │     │ away_team     │
                    │ is_active       │     │ home_score    │
                    └─────────────────┘     │ away_score    │
                                            │ status        │
                   ┌────────────────────┐   │ kickoff_time  │
                   │ group_tournaments   │   │ matchday      │
                   │────────────────────│   │ api_match_id  │
                   │ group_id (FK)      │   └──────┬───────┘
                   │ tournament_id (FK) │          │
                   │ added_at           │          │ 1:N
                   └────────────────────┘          ▼
                                           ┌──────────────────┐
                                           │   predictions     │
                                           │──────────────────│
                                           │ id                │
                                           │ user_id (FK)      │
                                           │ match_id (FK)     │
                                           │ group_id (FK)     │
                                           │ home_score_pred   │
                                           │ away_score_pred   │
                                           │ points            │
                                           │ created_at        │
                                           │ updated_at        │
                                           │ UNIQUE(user_id,   │
                                           │  match_id,        │
                                           │  group_id)        │
                                           └──────────────────┘

┌─────────────────┐     ┌──────────────────┐
│ leaderboard_cache│    │  notifications    │
│─────────────────│     │──────────────────│
│ id              │     │ id               │
│ group_id (FK)   │     │ user_id (FK)     │
│ tournament_id   │     │ type             │
│ user_id (FK)    │     │ title            │
│ total_points    │     │ body             │
│ position        │     │ data (JSONB)     │
│ matches_played  │     │ read             │
│ exact_scores    │     │ created_at       │
│ correct_results │     │ sent_at          │
│ updated_at      │     └──────────────────┘
└─────────────────┘
```

### 3.2 Definición SQL Detallada

```sql
-- =============================================
-- PROFILES (extiende auth.users de Supabase)
-- =============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  push_token TEXT,
  bio TEXT,
  favorite_team TEXT,
  points_total INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- TOURNAMENTS (Torneos disponibles)
-- =============================================
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_name TEXT,
  sport TEXT NOT NULL DEFAULT 'football',
  country TEXT,
  season TEXT NOT NULL,
  api_league_id INTEGER,              -- ID en API-Football
  logo_url TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming', 'active', 'finished')),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- MATCHES (Partidos)
-- =============================================
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id),
  api_match_id INTEGER UNIQUE,        -- ID en API-Football
  home_team_name TEXT NOT NULL,
  away_team_name TEXT NOT NULL,
  home_team_logo TEXT,
  away_team_logo TEXT,
  home_score INTEGER,                 -- NULL hasta que termine
  away_score INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'live', 'finished', 'postponed', 'cancelled')),
  kickoff_time TIMESTAMPTZ NOT NULL,
  matchday INTEGER,
  venue TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para queries frecuentes
CREATE INDEX idx_matches_tournament_status ON matches(tournament_id, status);
CREATE INDEX idx_matches_kickoff ON matches(kickoff_time);

-- =============================================
-- GROUPS (Ligas Privadas / Grupos de Amigos)
-- =============================================
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  invite_code TEXT UNIQUE NOT NULL DEFAULT substr(md5(random()::text), 1, 8),
  avatar_url TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  scoring_system JSONB NOT NULL DEFAULT '{
    "exact_score": 5,
    "correct_result": 3,
    "correct_goal_diff": 1,
    "wrong": 0
  }'::jsonb,
  max_members INTEGER DEFAULT 50,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- GROUP_MEMBERS (Relación Usuarios <-> Grupos)
-- =============================================
CREATE TABLE group_members (
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('admin', 'moderator', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  PRIMARY KEY (group_id, user_id)
);

-- =============================================
-- GROUP_TOURNAMENTS (Torneos asignados a grupos)
-- =============================================
CREATE TABLE group_tournaments (
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES tournaments(id),
  added_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (group_id, tournament_id)
);

-- =============================================
-- PREDICTIONS (Predicciones de los usuarios)
-- =============================================
CREATE TABLE predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  match_id UUID NOT NULL REFERENCES matches(id),
  group_id UUID NOT NULL REFERENCES groups(id),
  home_score_pred INTEGER NOT NULL CHECK (home_score_pred >= 0),
  away_score_pred INTEGER NOT NULL CHECK (away_score_pred >= 0),
  points INTEGER,                     -- NULL hasta que se calcule
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, match_id, group_id) -- Una predicción por partido por grupo
);

CREATE INDEX idx_predictions_group_match ON predictions(group_id, match_id);
CREATE INDEX idx_predictions_user_group ON predictions(user_id, group_id);

-- =============================================
-- LEADERBOARD_CACHE (Tabla materializada de ranking)
-- =============================================
CREATE TABLE leaderboard_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  tournament_id UUID REFERENCES tournaments(id),
  user_id UUID NOT NULL REFERENCES profiles(id),
  total_points INTEGER DEFAULT 0,
  position INTEGER,
  matches_played INTEGER DEFAULT 0,
  exact_scores INTEGER DEFAULT 0,
  correct_results INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, tournament_id, user_id)
);

CREATE INDEX idx_leaderboard_group_tournament ON leaderboard_cache(group_id, tournament_id, position);

-- =============================================
-- NOTIFICATIONS (Historial de notificaciones)
-- =============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL
    CHECK (type IN ('match_reminder', 'result_update', 'ranking_change',
                    'group_invite', 'achievement', 'social')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,                         -- Datos adicionales (match_id, group_id, etc.)
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX idx_notifications_user_read ON notifications(user_id, read);
```

### 3.3 Row Level Security (Políticas clave)

```sql
-- Profiles: lectura pública, escritura solo propia
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Predictions: solo antes del kickoff
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert predictions before match starts"
  ON predictions FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    (SELECT kickoff_time FROM matches WHERE id = match_id) > now()
  );

CREATE POLICY "Users can update own predictions before match starts"
  ON predictions FOR UPDATE USING (
    auth.uid() = user_id AND
    (SELECT kickoff_time FROM matches WHERE id = match_id) > now()
  );

CREATE POLICY "Users can view predictions in their groups (after match starts)"
  ON predictions FOR SELECT USING (
    group_id IN (
      SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
    AND (
      user_id = auth.uid()  -- Siempre puede ver las propias
      OR (SELECT kickoff_time FROM matches WHERE id = match_id) <= now()
    )
  );

-- Groups: miembros pueden ver, admin puede editar
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view group"
  ON groups FOR SELECT USING (
    id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
    OR is_public = true
  );

CREATE POLICY "Group admins can update group"
  ON groups FOR UPDATE USING (
    id IN (
      SELECT group_id FROM group_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
```

---

## 4. Módulos de la App

### 4.1 Sistema de Autenticación

**Proveedores de Login:**

- **Google Sign-In** — Cubre la mayoría de usuarios Android y web
- **Apple Sign-In** — Obligatorio para iOS apps con login social (App Store requirement)
- **Email + Password** — Fallback para usuarios sin redes sociales
- **Biometría (Face ID / Huella)** — Re-autenticación rápida para usuarios que ya tienen sesión iniciada

**Flujo de autenticación:**

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│  Splash      │     │  Welcome     │     │  Login/       │
│  Screen      │────▶│  Screen      │────▶│  Register     │
│  (auto-login)│     │  (1ra vez)   │     │  Screen       │
└──────┬──────┘     └──────────────┘     └───────┬───────┘
       │                                          │
       │ token válido                    ┌────────┼────────────────┐
       │                                 │        │                 │
       │                          ┌──────▼──────┐ │  ┌─────▼──────┐
       │                          │  Social      │ │  │  Email     │
       │                          │  Login       │ │  │  Login     │
       │                          │  (Google/    │ │  └────────────┘
       │                          │   Apple)     │ │
       │                          └──────┬───────┘ │
       │                                 │         │
       │                                 ▼         │
       │                          ┌────────────────┘
       │                          │
       ▼                          ▼
┌─────────────┐     ┌──────────────────┐
│  Biometric   │     │  Home Screen     │
│  Prompt      │────▶│                  │
│  (Face ID/   │     └──────────────────┘
│   Huella)    │            ▲
└──────┬───────┘            │
       │ fallback           │
       ▼                    │
┌─────────────┐             │
│  PIN / Login │─────────────┘
│  Manual      │
└──────────────┘
```

**Autenticación biométrica (Face ID / Huella dactilar):**

Usa `expo-local-authentication` (incluido en Expo SDK 55) para autenticación biométrica local. NO reemplaza el login inicial — es un mecanismo de **re-autenticación rápida** para sesiones existentes.

**¿Cómo funciona?**

1. El usuario se registra/inicia sesión normalmente (Google, Apple, o Email)
2. Después del primer login exitoso, se le ofrece activar biometría
3. Si acepta, la sesión de Supabase se almacena cifrada en `expo-secure-store`
4. En futuros accesos, se muestra el prompt biométrico antes de desbloquear la app
5. Si la biometría falla o no está disponible, fallback a login manual

**Flujo técnico:**

```
App Open → ¿Hay sesión almacenada?
  ├── NO → Welcome Screen (login normal)
  └── SÍ → ¿Biometría habilitada?
        ├── NO → Auto-login con token (refresh si expiró)
        └── SÍ → Prompt biométrico
              ├── ÉXITO → Desbloquear sesión → Home
              └── FALLO → ¿Reintentar?
                    ├── SÍ → Prompt biométrico
                    └── NO → Login manual
```

**Casos a manejar:**

- **Dispositivo sin biometría** — No ofrecer la opción, usar auto-login con token
- **Biometría no enrollada** — Mostrar mensaje para configurarla en Ajustes del dispositivo
- **Face ID + huella disponibles** — `expo-local-authentication` usa el método preferido del OS
- **Cambio de biometría** — Si el usuario agrega/elimina huellas, invalidar y re-autenticar
- **Background/foreground** — Re-pedir biometría si la app estuvo en background > 5 minutos (configurable)

**Configuración de usuario (en Settings):**

- Toggle: Activar/desactivar desbloqueo biométrico
- Toggle: Requerir biometría al abrir la app
- Selector: Tiempo de gracia antes de re-pedir biometría (1min, 5min, 15min, siempre)

**Implementación con Supabase Auth:**

- Supabase provee SDKs para Google y Apple login que funcionan con Expo
- Los tokens JWT se integran automáticamente con RLS
- El perfil del usuario se crea automáticamente via database trigger al registrarse
- `expo-secure-store` almacena la sesión de forma segura (cifrada con biometría cuando está habilitada)
- `expo-local-authentication` maneja Face ID (iOS), Touch ID (iOS), y huella dactilar (Android)

**Post-Login - Onboarding:**

1. Seleccionar nombre de usuario (validación de unicidad en tiempo real)
2. Subir foto de perfil (opcional, se usa avatar generado por defecto)
3. Seleccionar equipo favorito (opcional)
4. Activar desbloqueo biométrico (si el dispositivo lo soporta)
5. Tutorial breve (3 pantallas con animaciones)

### 4.2 Creación y Gestión de Grupos (Ligas Privadas)

**Crear un grupo:**

1. Nombre del grupo + descripción opcional
2. Seleccionar torneos a seguir (multi-select)
3. Configurar sistema de puntuación (presets o personalizado)
4. Límite de miembros (default: 50)
5. Se genera un código de invitación único de 8 caracteres

**Unirse a un grupo:**

- **Por código** — Ingresar el código de 8 caracteres
- **Por deep link** — `pencaviva://join/ABC12345` o link universal
- **Por QR** — Escanear QR generado en la app (ideal para amigos presenciales)
- **Grupos públicos** — Explorar y unirse (fase futura)

**Roles:**
| Rol | Permisos |
|---|---|
| Admin (creador) | Todo: editar grupo, expulsar miembros, cambiar scoring, eliminar grupo |
| Moderador | Invitar, silenciar miembros |
| Miembro | Predecir, ver ranking, chat |

**Funcionalidades del grupo:**

- Feed de actividad (quién predijo, quién subió en el ranking)
- Chat del grupo (mensajes de texto, reacciones con emojis)
- Estadísticas del grupo (predictor más preciso, racha más larga, etc.)
- Compartir grupo por redes sociales (imagen generada con ranking)

### 4.3 Motor de Predicciones

#### ¿Cómo se ingresan las predicciones?

```
┌─────────────────────────────────────────────────┐
│  Fecha 5 - Clausura 2026                         │
├─────────────────────────────────────────────────┤
│                                                   │
│  🟢 Nacional   [ 2 ] - [ 1 ]   Peñarol  🟢     │
│  Sáb 28 Feb - 20:00                Estadio Gran  │
│  ──────────────────────────────────────────────── │
│  🟢 Defensor   [ 0 ] - [ 0 ]   Danubio  🟢     │
│  Dom 1 Mar - 17:30                 Franzini       │
│  ──────────────────────────────────────────────── │
│  ⚪ Liverpool  [   ] - [   ]   Wanderers ⚪     │
│  Dom 1 Mar - 20:00                  Belvedere     │
│  ──────────────────────────────────────────────── │
│                                                   │
│  🟢 = Predicción hecha  ⚪ = Sin predicción      │
│                                                   │
│           [ Guardar Predicciones ]                │
│                                                   │
└─────────────────────────────────────────────────┘
```

**Reglas:**

- Se puede predecir **hasta 15 minutos antes del kickoff** del partido individual
- Se pueden modificar predicciones ya hechas (hasta 15 minutos antes del kickoff)
- Los resultados solo son visibles para los demás después del kickoff (RLS)
- Confirmación visual inmediata (animación + haptic feedback)
- Scroll por fecha/jornada

#### ¿Cómo se cargan los resultados?

**Flujo automático (producción):**

```
API-Football ──(webhook/polling)──▶ Supabase Edge Function
                                         │
                                    ┌────▼────┐
                                    │ Actualiza│
                                    │ tabla    │
                                    │ matches  │
                                    └────┬────┘
                                         │ Database trigger
                                    ┌────▼────────────┐
                                    │ calculate_points │
                                    │ (DB function)    │
                                    └────┬────────────┘
                                         │
                                    ┌────▼──────────────┐
                                    │ Actualiza          │
                                    │ predictions.points │
                                    │ leaderboard_cache  │
                                    └────┬──────────────┘
                                         │
                                    ┌────▼──────────┐
                                    │ Push Notif     │
                                    │ (Expo Push)    │
                                    └───────────────┘
```

**Flujo manual (MVP/backup):**

- Panel admin (web simple o pantalla en la app) para que un admin cargue resultados manualmente
- Útil para torneos locales sin cobertura de API

#### ¿Cómo se calculan los puntos?

**Sistema de puntuación default (configurable por grupo):**

| Resultado                                   | Puntos     | Ejemplo                                       |
| ------------------------------------------- | ---------- | --------------------------------------------- |
| **Resultado exacto**                        | 5 pts      | Predicción: 2-1, Real: 2-1                    |
| **Resultado correcto** (gana/empata/pierde) | 3 pts      | Predicción: 2-1, Real: 3-0 (ambos gana local) |
| **Diferencia de goles correcta**            | 1 pt bonus | Predicción: 2-0, Real: 3-1 (ambos +2)         |
| **Resultado incorrecto**                    | 0 pts      | Predicción: 2-1, Real: 0-3                    |

**Función PostgreSQL para cálculo:**

```sql
CREATE OR REPLACE FUNCTION calculate_prediction_points(
  p_home_pred INTEGER,
  p_away_pred INTEGER,
  p_home_real INTEGER,
  p_away_real INTEGER,
  p_scoring JSONB
) RETURNS INTEGER AS $$
DECLARE
  points INTEGER := 0;
  pred_result INTEGER; -- 1=home, 0=draw, -1=away
  real_result INTEGER;
BEGIN
  -- Resultado exacto
  IF p_home_pred = p_home_real AND p_away_pred = p_away_real THEN
    RETURN (p_scoring->>'exact_score')::INTEGER;
  END IF;

  -- Determinar resultado (1=local, 0=empate, -1=visitante)
  pred_result := SIGN(p_home_pred - p_away_pred);
  real_result := SIGN(p_home_real - p_away_real);

  -- Resultado correcto (quién gana/empate)
  IF pred_result = real_result THEN
    points := (p_scoring->>'correct_result')::INTEGER;

    -- Bonus: diferencia de goles correcta
    IF (p_home_pred - p_away_pred) = (p_home_real - p_away_real) THEN
      points := points + (p_scoring->>'correct_goal_diff')::INTEGER;
    END IF;
  END IF;

  RETURN points;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

**Trigger automático al actualizar resultado:**

```sql
CREATE OR REPLACE FUNCTION process_match_result()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo procesar cuando cambia a 'finished'
  IF NEW.status = 'finished' AND OLD.status != 'finished' THEN
    -- Calcular puntos para todas las predicciones de este partido
    UPDATE predictions p
    SET points = calculate_prediction_points(
      p.home_score_pred,
      p.away_score_pred,
      NEW.home_score,
      NEW.away_score,
      (SELECT scoring_system FROM groups WHERE id = p.group_id)
    ),
    updated_at = now()
    WHERE p.match_id = NEW.id AND p.points IS NULL;

    -- Refresh leaderboard cache
    PERFORM refresh_leaderboard_cache(NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_match_result_update
  AFTER UPDATE ON matches
  FOR EACH ROW
  WHEN (NEW.status = 'finished' AND OLD.status != 'finished')
  EXECUTE FUNCTION process_match_result();
```

### 4.4 Ranking / Leaderboard en Tiempo Real

**Estructura del leaderboard:**

```
┌─────────────────────────────────────────────────┐
│  🏆 Ranking - Los Pibes FC                       │
│  Clausura 2026                                    │
├─────────────────────────────────────────────────┤
│                                                   │
│  #1  🥇 Juan P.        142 pts  ▲ +2             │
│         28 partidos | 8 exactos | 15 aciertos    │
│  ──────────────────────────────────────────────── │
│  #2  🥈 María G.       138 pts  ▼ -1             │
│         28 partidos | 7 exactos | 16 aciertos    │
│  ──────────────────────────────────────────────── │
│  #3  🥉 Pedro L.       135 pts  ── 0             │
│         27 partidos | 9 exactos | 12 aciertos    │
│  ──────────────────────────────────────────────── │
│  #4     Tú (Hernán)    130 pts  ▲ +3             │
│         28 partidos | 6 exactos | 17 aciertos    │
│  ──────────────────────────────────────────────── │
│  ...                                              │
│                                                   │
│  [ General ] [ Fecha 5 ] [ Últimos 5 ]           │
│                                                   │
└─────────────────────────────────────────────────┘
```

**Actualización en tiempo real:**

- Se usa **Supabase Realtime** suscrito a cambios en `leaderboard_cache`
- Cuando un resultado se procesa, el trigger actualiza el cache y Realtime propaga el cambio
- El cliente recibe la actualización y anima el cambio de posición

```typescript
// Suscripción Realtime al leaderboard
const channel = supabase
  .channel("leaderboard")
  .on(
    "postgres_changes",
    {
      event: "UPDATE",
      schema: "public",
      table: "leaderboard_cache",
      filter: `group_id=eq.${groupId}`,
    },
    (payload) => {
      // Actualizar el estado local con animación
      updateLeaderboard(payload.new);
    },
  )
  .subscribe();
```

**Vistas del ranking:**

- **General** — Todos los puntos del torneo
- **Por fecha** — Puntos de una jornada específica
- **Últimos N partidos** — Tendencia reciente
- **Cabeza a cabeza** — Comparar dos jugadores

### 4.5 Notificaciones Push

**Tipos de notificaciones:**

| Tipo                       | Trigger                    | Timing                        | Prioridad |
| -------------------------- | -------------------------- | ----------------------------- | --------- |
| Recordatorio de predicción | Cron job                   | 2h y 30min antes del kickoff  | Alta      |
| Partido en vivo            | API-Football status change | Cuando empieza el partido     | Media     |
| Resultado disponible       | Trigger de match_result    | Inmediato al finalizar        | Alta      |
| Cambio en ranking          | Leaderboard update         | Después del cálculo de puntos | Media     |
| Invitación a grupo         | Acción de otro usuario     | Inmediato                     | Media     |
| Logro desbloqueado         | Evaluación post-resultado  | Después del cálculo           | Baja      |

**Implementación con Edge Functions + Expo Push:**

```typescript
// Edge Function: send-push-notification
import { createClient } from "@supabase/supabase-js";

Deno.serve(async (req) => {
  const { user_ids, title, body, data } = await req.json();
  const supabase = createClient(/* ... */);

  // Obtener push tokens de los usuarios
  const { data: profiles } = await supabase
    .from("profiles")
    .select("push_token")
    .in("id", user_ids)
    .not("push_token", "is", null);

  // Enviar via Expo Push API
  const messages = profiles.map((p) => ({
    to: p.push_token,
    title,
    body,
    data,
    sound: "default",
    badge: 1,
  }));

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messages),
  });

  return new Response(JSON.stringify({ sent: messages.length }));
});
```

**Configuración de usuario:**

- Toggle por tipo de notificación (activar/desactivar recordatorios, resultados, etc.)
- Modo silencioso por horario
- Frecuencia de recordatorios configurable

---

## 5. UX/UI

### 5.1 Principios de Diseño

1. **Dark mode first** — Esquema oscuro como default (la mayoría de apps deportivas se usan de noche)
2. **One-thumb navigation** — Todo accesible con una mano en el celular
3. **Feedback instantáneo** — Haptics + animaciones para cada acción
4. **Información jerárquica** — Lo más importante primero, detalles bajo demanda
5. **Deportivo pero elegante** — Evitar la estética "apuestas"; ser más social y limpio

### 5.2 Paleta de Colores

```
Dark Mode (Default):
──────────────────────────────
Background     : #0D0D0D (casi negro)
Surface        : #1A1A2E (azul muy oscuro)
Surface Alt    : #16213E (navy profundo)
Primary        : #00D4AA (verde esmeralda vibrante)
Secondary      : #7C5CFC (violeta eléctrico)
Accent         : #FFB800 (dorado para badges/trofeos)
Text Primary   : #FFFFFF
Text Secondary : #A0A0B8
Error          : #FF4757
Success        : #2ED573
Warning        : #FFA502

Light Mode:
──────────────────────────────
Background     : #F5F5FA
Surface        : #FFFFFF
Primary        : #00B894
Secondary      : #6C5CE7
Text Primary   : #2D3436
```

### 5.3 Estructura de Navegación

```
Tab Bar (Bottom Navigation)
├── 🏠 Inicio
│   ├── Próximos partidos (cards horizontales)
│   ├── Mis predicciones pendientes (badge count)
│   ├── Actividad reciente del grupo activo
│   └── Quick Stats (puntos totales, posición)
│
├── ⚽ Predecir
│   ├── Lista de partidos por fecha
│   ├── Input de predicciones (numérico)
│   ├── Estado de predicción (hecha/pendiente/cerrada)
│   └── Filtrar por torneo
│
├── 🏆 Ranking
│   ├── Leaderboard del grupo activo
│   ├── Tabs: General / Fecha / Tendencia
│   ├── Detalle de jugador (estadísticas)
│   └── Comparar jugadores
│
├── 👥 Grupos
│   ├── Lista de mis grupos
│   ├── Crear grupo
│   ├── Unirse a grupo (código/QR/link)
│   ├── Detalle de grupo
│   │   ├── Miembros
│   │   ├── Torneos
│   │   ├── Configuración (admin)
│   │   └── Chat del grupo
│   └── Invitar amigos
│
└── 👤 Perfil
    ├── Mi perfil (avatar, stats, badges)
    ├── Historial de predicciones
    ├── Configuración
    │   ├── Notificaciones
    │   ├── Seguridad (biometría, tiempo de gracia)
    │   ├── Tema (dark/light)
    │   └── Cuenta
    └── Cerrar sesión
```

### 5.4 Micro-interacciones Clave

| Acción                 | Animación                       | Feedback                       |
| ---------------------- | ------------------------------- | ------------------------------ |
| Guardar predicción     | Confetti sutil + check animado  | Haptic (success)               |
| Resultado exacto       | Animación de estrella dorada    | Haptic (impact heavy) + sonido |
| Subir en el ranking    | Slide up con glow verde         | Haptic (impact light)          |
| Bajar en el ranking    | Slide down con flash rojo       | Haptic (warning)               |
| Unirse a grupo         | Animación de puerta abriéndose  | Haptic (success)               |
| Pull to refresh        | Pelota de fútbol rebotando      | Spring animation               |
| Cargar partido en vivo | Pulso rojo en el indicador LIVE | Loop continuo                  |

### 5.5 Pantallas Principales (Wireframes conceptuales)

**Pantalla de Predicción:**

- Cards por partido con logos de equipos
- Input numérico con stepper (+/-) o teclado numérico
- Indicador visual del estado (pendiente, hecha, cerrada)
- Countdown al kickoff por partido
- Swipe para navegar entre fechas

**Pantalla de Leaderboard:**

- Top 3 con diseño destacado (oro, plata, bronce)
- Mi posición siempre visible (sticky si estoy fuera del viewport)
- Cambio de posición con flecha y color (verde arriba, rojo abajo)
- Expandir un jugador para ver sus predicciones del último partido
- Tab bar: General | Por Fecha | Tendencia

---

## 6. Integraciones

### 6.1 API de Datos Deportivos

**Proveedor principal: API-Football (via RapidAPI)**

- **Cobertura**: 880+ ligas incluyendo Liga Uruguaya, Libertadores, Sudamericana, Premier League, Champions League, Copa América, Mundial
- **Datos disponibles**: Fixtures, resultados en vivo, alineaciones, estadísticas, standings
- **Pricing**:

| Plan  | Requests/día | Costo/mes | Para qué fase                    |
| ----- | ------------ | --------- | -------------------------------- |
| Free  | 100          | $0        | Desarrollo/testing               |
| Pro   | 7,500        | $19       | MVP (suficiente para 5-10 ligas) |
| Ultra | 75,000       | $29       | Producción con muchos torneos    |
| Mega  | 150,000      | $39       | Escala grande                    |

**Flujo de sincronización:**

```
┌─────────────┐     ┌──────────────────┐     ┌───────────┐
│ API-Football │────▶│ Edge Function    │────▶│ PostgreSQL│
│              │     │ (match-sync)     │     │ (matches) │
└─────────────┘     └──────────────────┘     └───────────┘
                     Runs every:
                     - 24h: fixtures sync
                     - 1min: live matches
                     - Post-match: final scores
```

**Edge Function: match-sync**

```
1. Cron: cada 24h → GET /fixtures?league={id}&season=2026
   → INSERT/UPDATE matches (nuevos partidos, cambios de horario)

2. Cron: cada 1 min (solo si hay partidos en vivo)
   → GET /fixtures?live=all
   → UPDATE matches SET status='live', score=...

3. Webhook/poll: post-partido
   → GET /fixtures?id={match_id}
   → UPDATE matches SET status='finished', home_score=X, away_score=Y
   → Trigger: calculate_points → update leaderboard → send push
```

**Alternativas evaluadas:**

| API               | Cobertura UY       | Precio            | Notas                                     |
| ----------------- | ------------------ | ----------------- | ----------------------------------------- |
| API-Football      | Sí (Liga Uruguaya) | Desde $0          | Mejor opción. Buena doc, amplia cobertura |
| Football-Data.org | No                 | Gratis (limitado) | Solo ligas europeas top                   |
| SportMonks        | Sí                 | Desde $15/mes     | Buena alternativa, más cara               |
| Datos manuales    | N/A                | $0                | Backup para MVP / ligas sin API           |

**Recomendación**: Empezar con el **plan Free ($0)** durante desarrollo, y escalar al **Plan Pro ($19/mes)** para producción. Con 7,500 requests/día es más que suficiente para sincronizar la Liga Uruguaya (Apertura, Clausura, Copa Uruguay, Copa de la Liga AUF) + torneos internacionales (Libertadores, Sudamericana, Copa América, Mundial).

**Alternativas descartadas:**

- **football-data.org**: Liga Uruguaya solo disponible en plan Pro a 199 EUR/mes — prohibitivo
- **Sportmonks**: Plan Worldwide a 129 EUR/mes para cobertura uruguaya — demasiado caro para MVP
- **TheSportsDB**: Datos de Uruguay incompletos/inexistentes — no confiable como fuente primaria

### 6.2 Expo Push Notifications

- Servicio gratuito de Expo para enviar push a iOS (APNs) y Android (FCM)
- Se integra con Edge Functions de Supabase
- Los tokens se almacenan en `profiles.push_token`
- Soporta notificaciones con acciones, imágenes, y deep links

### 6.3 Monitoreo y Analytics

| Servicio         | Propósito                        | Costo                 |
| ---------------- | -------------------------------- | --------------------- |
| Sentry           | Crash reporting + error tracking | Free (5K eventos/mes) |
| Expo Insights    | Analytics básicos de la app      | Incluido con Expo     |
| PostHog (futuro) | Product analytics avanzados      | Free (1M eventos/mes) |

---

## 7. Roadmap de Implementación

### Fase 0: Setup del Proyecto (Semana 1)

**Comandos de inicialización:**

```bash
# Crear proyecto con Expo SDK 55 + TypeScript
npx create-expo-app pencaviva --template bare-minimum

# Instalar dependencias core
npx expo install nativewind@preview react-native-css react-native-reanimated react-native-safe-area-context
npx expo install --dev tailwindcss @tailwindcss/postcss postcss

# Instalar dependencias de datos y estado
npm install @supabase/supabase-js@latest @tanstack/react-query zustand

# Instalar utilidades
npm install date-fns @date-fns/tz

# Requiere Node.js >= 20.19.x
```

| Tarea                                                        | Esfuerzo | Done Criteria                    |
| ------------------------------------------------------------ | -------- | -------------------------------- |
| Inicializar proyecto Expo SDK 55 con TypeScript              | 2h       | Proyecto corriendo en simulador  |
| Configurar Supabase (proyecto + auth)                        | 2h       | Login con Google/Apple funcional |
| Configurar ESLint + Prettier                                 | 1h       | Linting automático               |
| Crear estructura de carpetas (feature-based)                 | 1h       | Estructura definida              |
| Configurar NativeWind v5 + Tailwind CSS v4 (metro.config.js) | 2h       | Estilos Tailwind funcionando     |
| Setup de navegación (Expo Router v4)                         | 3h       | Tab navigation básica            |
| Crear esquema de BD (migrations)                             | 4h       | Todas las tablas creadas con RLS |
| Configurar EAS Build + Update                                | 2h       | Build de desarrollo funcional    |

**Total: ~17h (1 semana)**

### Fase 1: MVP Core (Semanas 2-5)

**Milestone 1: Auth + Perfil (Semana 2)**

| Tarea                                           | Esfuerzo | Depends On          |
| ----------------------------------------------- | -------- | ------------------- |
| Pantalla de Welcome/Onboarding                  | 4h       | Navegación          |
| Implementar Google Sign-In                      | 4h       | Supabase Auth       |
| Implementar Apple Sign-In                       | 4h       | Supabase Auth       |
| Pantalla de completar perfil (username, avatar) | 6h       | Auth                |
| Trigger de creación de perfil automático        | 2h       | BD                  |
| Pantalla de perfil (ver/editar)                 | 4h       | Auth + Perfil       |
| Autenticación biométrica (Face ID / Huella)     | 4h       | Auth + Secure Store |
| Configuración de biometría en Settings          | 2h       | Biometría           |

**Milestone 2: Grupos (Semana 3)**

| Tarea                              | Esfuerzo | Depends On  |
| ---------------------------------- | -------- | ----------- |
| Pantalla "Mis Grupos" (lista)      | 4h       | Auth        |
| Crear grupo (form + scoring setup) | 6h       | BD          |
| Generar código de invitación + QR  | 3h       | Crear grupo |
| Unirse a grupo (por código)        | 4h       | BD          |
| Deep link para invitaciones        | 3h       | Expo Router |
| Detalle del grupo (miembros, info) | 4h       | Grupos      |
| Asignar torneos a grupo            | 3h       | Torneos     |

**Milestone 3: Predicciones (Semana 4)**

| Tarea                                            | Esfuerzo | Depends On   |
| ------------------------------------------------ | -------- | ------------ |
| Sync de partidos (Edge Function + API-Football)  | 8h       | BD + API key |
| Pantalla de predicciones (lista de partidos)     | 6h       | Matches      |
| Input de predicción (stepper numérico)           | 4h       | UI           |
| Guardar predicciones (con validación de horario) | 4h       | RLS          |
| Ver predicciones de otros (post-kickoff)         | 3h       | RLS          |
| Cálculo de puntos (DB function)                  | 4h       | BD           |
| Trigger de actualización de leaderboard          | 3h       | Puntos       |

**Milestone 4: Leaderboard (Semana 5)**

| Tarea                                 | Esfuerzo | Depends On        |
| ------------------------------------- | -------- | ----------------- |
| Pantalla de ranking (lista ordenada)  | 6h       | Leaderboard cache |
| Suscripción Realtime al leaderboard   | 4h       | Supabase Realtime |
| Filtros (General / Fecha / Últimos N) | 4h       | Rankings          |
| Destacar mi posición                  | 2h       | UI                |
| Animaciones de cambio de posición     | 3h       | Reanimated        |
| Stats detalladas por jugador          | 4h       | Predictions       |

**Total Fase 1: ~105h (~4 semanas, un desarrollador full-time)**

### Fase 2: Polish + Notifications (Semanas 6-7)

| Tarea                                           | Esfuerzo | Depends On        |
| ----------------------------------------------- | -------- | ----------------- |
| Push notifications setup (Expo)                 | 4h       | Auth              |
| Recordatorio de predicción (Edge Function cron) | 4h       | Push + Matches    |
| Notificación de resultado disponible            | 3h       | Score calculation |
| Notificación de cambio de ranking               | 3h       | Leaderboard       |
| Pantalla de notificaciones (inbox)              | 4h       | Notifications     |
| Configuración de notificaciones (toggles)       | 3h       | Settings          |
| Pull to refresh en todas las pantallas          | 2h       | UI                |
| Loading states + skeletons                      | 4h       | UI                |
| Error handling global                           | 3h       | UX                |
| Animaciones y micro-interacciones               | 6h       | Reanimated        |
| Dark mode + Light mode toggle                   | 3h       | NativeWind        |
| Haptic feedback en acciones clave               | 2h       | Expo Haptics      |

**Total Fase 2: ~41h (~2 semanas)**

### Fase 3: Testing + Beta (Semanas 8-9)

| Tarea                                | Esfuerzo | Depends On       |
| ------------------------------------ | -------- | ---------------- |
| Test E2E de flujo completo           | 6h       | Todo             |
| Test de RLS policies                 | 4h       | BD               |
| Test de Edge Functions               | 3h       | Backend          |
| Performance profiling (render times) | 3h       | App completa     |
| Beta testing con 10-20 amigos        | 8h       | Build producción |
| Fix bugs reportados                  | 12h      | Beta feedback    |
| Optimización de queries lentas       | 4h       | Profiling        |
| Setup de Sentry para crash reporting | 2h       | Build            |

**Total Fase 3: ~42h (~2 semanas)**

### Fase 4: Launch (Semana 10)

| Tarea                                       | Esfuerzo | Depends On |
| ------------------------------------------- | -------- | ---------- |
| App Store assets (screenshots, descripción) | 4h       | App final  |
| Privacy policy + Terms of service           | 3h       | Legal      |
| Submit a App Store (iOS)                    | 2h       | Assets     |
| Submit a Play Store (Android)               | 2h       | Assets     |
| Configurar EAS Update para OTA              | 1h       | Build      |
| Landing page simple (opcional)              | 4h       | Marketing  |
| Monitoreo post-lanzamiento                  | Ongoing  | Sentry     |

**Total Fase 4: ~16h (1 semana)**

### Fases Futuras (Post-Launch)

**Fase 5: Social (Semanas 11-14)**

- Chat en grupo (Supabase Realtime Broadcast)
- Reacciones a predicciones de otros
- Compartir resultados en redes sociales (imagen generada)
- Sistema de amigos / followers
- Feed de actividad social

**Fase 6: Gamification (Semanas 15-18)**

- Sistema de badges/logros (primera predicción exacta, racha de 5, etc.)
- Niveles de usuario (basado en participación)
- Predicción de la semana (destacar mejores predicciones)
- Streaks (rachas de aciertos)
- Desafíos 1vs1 entre amigos

**Fase 7: Expansión (Semanas 19+)**

- Grupos públicos con torneos oficiales
- Multi-deporte (básquetbol, tenis, etc.)
- Predicciones especiales (goleador, tarjetas, etc.)
- Ligas entre grupos (meta-competencia)
- Monetización: Premium (temas, estadísticas avanzadas, sin ads)
- Widgets nativos iOS/Android (próximo partido + predicción)

---

## 8. Riesgos y Mitigación

| Riesgo                                                 | Impacto | Probabilidad | Mitigación                                                                                              |
| ------------------------------------------------------ | ------- | ------------ | ------------------------------------------------------------------------------------------------------- |
| **API-Football down o datos incorrectos**              | Alto    | Media        | Implementar fallback manual + validación de datos. Cachear fixtures localmente.                         |
| **Supabase Realtime no escala**                        | Alto    | Baja         | Para <5K usuarios no es problema. Plan: migrar a Supabase Pro. Alternativa: polling cada 30s.           |
| **Apple rechaza la app**                               | Alto    | Baja         | Cumplir guidelines desde día 1. NO mencionar "apuestas" — es una app social. Tener Apple Sign-In listo. |
| **Usuarios ingresan predicciones después del kickoff** | Alto    | Media        | RLS en la BD bloquea esto server-side. UI deshabilita inputs. Doble validación.                         |
| **Timezone issues (horarios de partidos)**             | Medio   | Alta         | Almacenar todo en UTC. Convertir a local en el cliente con `date-fns-tz`.                               |
| **Bajo engagement / retención**                        | Alto    | Media        | Push notifications inteligentes. Gamification en Fase 6. Onboarding con tutorial.                       |
| **Un solo desarrollador = bus factor**                 | Alto    | Alta         | Documentar decisiones en CLAUDE.md. Código limpio con TypeScript strict. Tests de las funciones core.   |
| **Costos de API escalan**                              | Medio   | Baja         | Empezar con plan Pro ($10). Cachear agresivamente. Solo sincronizar ligas activas.                      |

---

## 9. Métricas de Éxito

### MVP (Semana 10)

- [ ] App funcional en iOS y Android
- [ ] Auth con Google + Apple
- [ ] Crear/unirse a grupos
- [ ] Predecir resultados de al menos 1 torneo
- [ ] Leaderboard en tiempo real
- [ ] Push notifications básicas

### Mes 1 Post-Launch

- [ ] 500+ descargas
- [ ] 200+ usuarios activos semanales
- [ ] 50+ grupos creados
- [ ] Retención D7 > 40%
- [ ] Rating promedio > 4.0
- [ ] < 1% crash rate

### Mes 3

- [ ] 2,000+ usuarios activos
- [ ] Features sociales lanzadas (Fase 5)
- [ ] 3+ torneos activos simultáneamente
- [ ] Retención D30 > 25%

---

## Estructura de Carpetas del Proyecto

```
app/                          # Expo Router (file-based routing)
├── (auth)/                   # Grupo de rutas de auth
│   ├── welcome.tsx
│   ├── login.tsx
│   └── complete-profile.tsx
├── (tabs)/                   # Tab navigation principal
│   ├── index.tsx             # Home
│   ├── predict.tsx           # Predicciones
│   ├── ranking.tsx           # Leaderboard
│   ├── groups/
│   │   ├── index.tsx         # Lista de grupos
│   │   ├── [id].tsx          # Detalle de grupo
│   │   ├── create.tsx        # Crear grupo
│   │   └── join.tsx          # Unirse a grupo
│   └── profile.tsx           # Perfil
├── match/[id].tsx            # Detalle de partido
├── notifications.tsx         # Centro de notificaciones
└── _layout.tsx               # Layout raíz
│
src/
├── components/               # Componentes reutilizables
│   ├── ui/                   # Primitivos (Button, Card, Input, etc.)
│   ├── match/                # MatchCard, PredictionInput, ScoreDisplay
│   ├── ranking/              # LeaderboardRow, PositionBadge
│   └── group/                # GroupCard, MemberList, InviteCode
├── hooks/                    # Custom hooks
│   ├── useAuth.ts
│   ├── useBiometrics.ts
│   ├── usePredictions.ts
│   ├── useLeaderboard.ts
│   ├── useGroups.ts
│   └── useNotifications.ts
├── lib/                      # Utilidades y configuración
│   ├── supabase.ts           # Cliente Supabase
│   ├── queryClient.ts        # TanStack Query config
│   └── constants.ts          # Colores, config, etc.
├── stores/                   # Zustand stores
│   ├── authStore.ts
│   └── appStore.ts
├── types/                    # TypeScript types (generados + custom)
│   ├── database.ts           # Auto-generated from Supabase
│   └── app.ts
└── utils/                    # Funciones utilitarias
    ├── scoring.ts            # Cálculo de puntos (mirror del server)
    ├── dates.ts              # Formateo de fechas
    └── validation.ts         # Validaciones de formularios

supabase/
├── migrations/               # SQL migrations
│   ├── 001_initial_schema.sql
│   ├── 002_rls_policies.sql
│   └── 003_functions_triggers.sql
└── functions/                # Edge Functions
    ├── match-sync/
    │   └── index.ts
    ├── calculate-scores/
    │   └── index.ts
    └── send-notification/
        └── index.ts
```

---

## Próximos Pasos Inmediatos

1. **Crear el proyecto Expo** con la estructura definida
2. **Crear el proyecto Supabase** y aplicar las migraciones del esquema
3. **Obtener API key de API-Football** (plan free para desarrollo)
4. **Implementar auth** (Google + Apple Sign-In con Supabase)
5. **Construir la pantalla de predicciones** (core de la app)

---

_Este plan fue diseñado para ser ejecutado por un desarrollador solo o un equipo pequeño (2-3 personas). Las estimaciones asumen un desarrollador full-stack con experiencia en React Native._
