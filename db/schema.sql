-- Ogwashi Farmers Registry: database schema (PostgreSQL, built for Neon).
-- Run this once, in the Neon SQL Editor, on an empty database.
-- Then create the first admin from your terminal (see README.md).

create table users (
  id bigint generated always as identity primary key,
  username text not null,
  display_name text not null,
  role text not null check (role in ('admin', 'agent')),
  password_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  must_change_password boolean not null default false,
  session_version integer not null default 0
);
create unique index users_username_key on users (lower(username));

create table farmers (
  id bigint generated always as identity primary key,
  full_name text not null,
  phone text not null unique,
  village text not null,
  primary_crop text not null,
  farm_size_hectares numeric(8,2) not null default 0,
  gps_lat double precision,
  gps_lng double precision,
  created_at timestamptz not null default now(),
  created_by bigint,
  updated_at timestamptz,
  updated_by bigint
);

create table login_attempts (
  id bigint generated always as identity primary key,
  ip text not null,
  attempted_at timestamptz not null default now(),
  username text
);
create index on login_attempts (ip, attempted_at);
create index on login_attempts (username, attempted_at);

-- Removed farmers: the reason is kept, names and phone numbers are not.
create table deletion_log (
  id bigint generated always as identity primary key,
  farmer_id bigint not null,
  village text not null,
  primary_crop text not null,
  farm_size_hectares numeric(8,2) not null,
  farmer_created_at timestamptz not null,
  reason text not null,
  note text,
  deleted_at timestamptz not null default now(),
  deleted_by bigint
);

-- Everything that happens in the app. Holds no names or phone numbers.
create table activity_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id bigint,
  username text,
  action text not null,
  farmer_id bigint,
  details jsonb not null default '{}'::jsonb,
  ip text
);
create index activity_log_at_idx on activity_log (at desc);
create index activity_log_farmer_idx on activity_log (farmer_id);
