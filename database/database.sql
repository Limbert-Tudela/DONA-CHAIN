SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "-04:00";
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP DATABASE IF EXISTS dona_chain_db;
CREATE DATABASE dona_chain_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE dona_chain_db;

CREATE TABLE usuarios (
  id                INT          NOT NULL AUTO_INCREMENT,
  nombre            VARCHAR(100) NOT NULL,
  email             VARCHAR(150) NOT NULL,
  password_hash     VARCHAR(255) NOT NULL COMMENT 'Hash BCRYPT',
  telefono          VARCHAR(20)  NULL,
  ci                VARCHAR(20)  NOT NULL COMMENT 'Cédula de Identidad',
  ci_foto_url       VARCHAR(255) NULL,
  ci_verificado     BOOLEAN      NOT NULL DEFAULT FALSE,
  rol               ENUM('donante','admin','superadmin','empresa') NOT NULL DEFAULT 'donante',
  `2fa_secret`      VARCHAR(100) NULL COMMENT 'Secreto TOTP (Base32)',
  intentos_fallidos INT          NOT NULL DEFAULT 0,
  bloqueado_hasta   DATETIME     NULL DEFAULT NULL,
  estado            ENUM('activo','suspendido') NOT NULL DEFAULT 'activo',
  fecha_registro    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_email (email),
  UNIQUE KEY uq_usuarios_ci (ci),
  KEY idx_usuarios_rol (rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE organizaciones (
  id                       INT          NOT NULL AUTO_INCREMENT,
  id_usuario_representante INT          NOT NULL,
  nombre_legal             VARCHAR(200) NOT NULL,
  nit                      VARCHAR(20)  NOT NULL,
  tipo                     ENUM('ONG','Fundacion','Empresa') NOT NULL,
  estado_verificacion      ENUM('pendiente','aprobado','rechazado') NOT NULL DEFAULT 'pendiente',
  documento_url            VARCHAR(255) NULL,
  fecha_registro           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_organizaciones_nit (nit),
  KEY idx_org_representante (id_usuario_representante),
  CONSTRAINT fk_org_usuario FOREIGN KEY (id_usuario_representante)
    REFERENCES usuarios (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE auditoria (
  id          INT          NOT NULL AUTO_INCREMENT,
  id_usuario  INT          NULL,
  accion      VARCHAR(100) NOT NULL,
  descripcion TEXT         NULL,
  ip_address  VARCHAR(45)  NULL,
  user_agent  VARCHAR(255) NULL,
  fecha       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_auditoria_usuario (id_usuario),
  KEY idx_auditoria_accion (accion),
  KEY idx_auditoria_fecha (fecha),
  CONSTRAINT fk_auditoria_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuarios (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE categorias (
  id          INT         NOT NULL AUTO_INCREMENT,
  nombre      VARCHAR(50) NOT NULL,
  icono       VARCHAR(50) NULL COMMENT 'Clase de Bootstrap Icons',
  descripcion TEXT        NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categorias_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE campanas (
  id                INT           NOT NULL AUTO_INCREMENT,
  id_organizacion   INT           NOT NULL,
  id_categoria      INT           NULL,
  titulo            VARCHAR(200)  NOT NULL,
  descripcion       TEXT          NULL,
  meta_fondos       DECIMAL(18,8) NOT NULL DEFAULT 0,
  meta_especies     TEXT          NULL COMMENT 'Insumos requeridos (texto libre)',
  fondos_recaudados DECIMAL(18,8) NOT NULL DEFAULT 0,
  estado            ENUM('borrador','activa','finalizada') NOT NULL DEFAULT 'borrador',
  fecha_cierre      DATETIME      NULL,
  es_urgente        BOOLEAN       NOT NULL DEFAULT FALSE,
  fecha_creacion    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_campanas_org (id_organizacion),
  KEY idx_campanas_cat (id_categoria),
  KEY idx_campanas_estado (estado),
  CONSTRAINT fk_campana_org FOREIGN KEY (id_organizacion)
    REFERENCES organizaciones (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_campana_categoria FOREIGN KEY (id_categoria)
    REFERENCES categorias (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE especies (
  id            INT         NOT NULL AUTO_INCREMENT,
  nombre        VARCHAR(50) NOT NULL,
  unidad_medida VARCHAR(20) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_especies_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE donaciones (
  id               INT           NOT NULL AUTO_INCREMENT,
  id_campana       INT           NOT NULL,
  id_usuario       INT           NULL,
  tipo_donacion    ENUM('efectivo','crypto','especie') NOT NULL,
  monto            DECIMAL(18,8) NOT NULL DEFAULT 0,
  id_especie       INT           NULL,
  cantidad_especie DECIMAL(10,2) NULL,
  estado           ENUM('pendiente','completado','rechazado','recibido') NOT NULL DEFAULT 'pendiente',
  comprobante_url  VARCHAR(255)  NULL,
  tx_hash          VARCHAR(66)   NULL,
  codigo_recepcion VARCHAR(20)   NULL,
  fecha            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_donaciones_tx (tx_hash),
  UNIQUE KEY uq_donaciones_codigo (codigo_recepcion),
  KEY idx_donaciones_campana (id_campana),
  KEY idx_donaciones_usuario (id_usuario),
  KEY idx_donaciones_especie (id_especie),
  KEY idx_donaciones_estado (estado),
  CONSTRAINT fk_donacion_campana FOREIGN KEY (id_campana)
    REFERENCES campanas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_donacion_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuarios (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_donacion_especie FOREIGN KEY (id_especie)
    REFERENCES especies (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE billeteras (
  id                     INT           NOT NULL AUTO_INCREMENT,
  id_usuario             INT           NOT NULL,
  direccion_publica      VARCHAR(66)   NOT NULL COMMENT '0x + SHA-256(email)',
  saldo                  DECIMAL(18,8) NOT NULL DEFAULT 0,
  clave_privada_simulada VARCHAR(255)  NOT NULL COMMENT 'Solo académica',
  PRIMARY KEY (id),
  UNIQUE KEY uq_billeteras_usuario (id_usuario),
  UNIQUE KEY uq_billeteras_direccion (direccion_publica),
  CONSTRAINT fk_billetera_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuarios (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE bloques (
  id            INT         NOT NULL AUTO_INCREMENT,
  indice        INT         NOT NULL,
  `timestamp`   DATETIME    NOT NULL,
  hash_anterior VARCHAR(64) NOT NULL,
  hash_actual   VARCHAR(64) NOT NULL,
  nonce         INT         NOT NULL DEFAULT 0,
  dificultad    INT         NOT NULL DEFAULT 2 COMMENT 'Ceros iniciales exigidos',
  minero        VARCHAR(66) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bloques_indice (indice),
  UNIQUE KEY uq_bloques_hash (hash_actual)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE transacciones_blockchain (
  id               INT           NOT NULL AUTO_INCREMENT,
  id_bloque        INT           NULL COMMENT 'NULL = en mempool (sin minar)',
  id_donacion      INT           NULL,
  from_address     VARCHAR(66)   NOT NULL,
  to_address       VARCHAR(66)   NOT NULL,
  monto            DECIMAL(18,8) NOT NULL DEFAULT 0,
  gas_usado        INT           NOT NULL DEFAULT 21000,
  hash_transaccion VARCHAR(66)   NOT NULL,
  fecha            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tx_hash (hash_transaccion),
  KEY idx_tx_bloque (id_bloque),
  KEY idx_tx_donacion (id_donacion),
  CONSTRAINT fk_tx_bloque FOREIGN KEY (id_bloque)
    REFERENCES bloques (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_tx_donacion FOREIGN KEY (id_donacion)
    REFERENCES donaciones (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE distribuciones (
  id                    INT           NOT NULL AUTO_INCREMENT,
  id_campana            INT           NOT NULL,
  monto_asignado        DECIMAL(18,8) NOT NULL DEFAULT 0,
  puntuacion_cuadratica DECIMAL(36,8) NOT NULL DEFAULT 0 COMMENT '(Σ √donación)²',
  fecha_calculo         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  hash_auditoria        VARCHAR(64)   NULL,
  PRIMARY KEY (id),
  KEY idx_distrib_campana (id_campana),
  CONSTRAINT fk_distrib_campana FOREIGN KEY (id_campana)
    REFERENCES campanas (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE fondo_reserva (
  id               INT           NOT NULL AUTO_INCREMENT,
  monto_total      DECIMAL(18,8) NOT NULL,
  id_admin_creador INT           NULL,
  fecha_creacion   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  distribuido      BOOLEAN       NOT NULL DEFAULT FALSE,
  PRIMARY KEY (id),
  KEY idx_fondo_admin (id_admin_creador),
  CONSTRAINT fk_fondo_admin FOREIGN KEY (id_admin_creador)
    REFERENCES usuarios (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notificaciones (
  id         INT          NOT NULL AUTO_INCREMENT,
  id_usuario INT          NOT NULL,
  titulo     VARCHAR(100) NOT NULL,
  mensaje    TEXT         NOT NULL,
  leida      BOOLEAN      NOT NULL DEFAULT FALSE,
  fecha      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notif_usuario (id_usuario, leida),
  CONSTRAINT fk_notif_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuarios (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE mensajes (
  id          INT       NOT NULL AUTO_INCREMENT,
  id_emisor   INT       NOT NULL,
  id_receptor INT       NOT NULL,
  id_campana  INT       NULL,
  mensaje     TEXT      NOT NULL,
  leido       BOOLEAN   NOT NULL DEFAULT FALSE,
  fecha       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_msg_emisor (id_emisor),
  KEY idx_msg_receptor (id_receptor, leido),
  KEY idx_msg_campana (id_campana),
  CONSTRAINT fk_msg_emisor FOREIGN KEY (id_emisor)
    REFERENCES usuarios (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_msg_receptor FOREIGN KEY (id_receptor)
    REFERENCES usuarios (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_msg_campana FOREIGN KEY (id_campana)
    REFERENCES campanas (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reportes (
  id          INT       NOT NULL AUTO_INCREMENT,
  id_usuario  INT       NULL,
  id_donacion INT       NULL,
  motivo      TEXT      NOT NULL,
  estado      ENUM('abierto','revisado') NOT NULL DEFAULT 'abierto',
  fecha       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rep_usuario (id_usuario),
  KEY idx_rep_donacion (id_donacion),
  CONSTRAINT fk_rep_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuarios (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_rep_donacion FOREIGN KEY (id_donacion)
    REFERENCES donaciones (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO usuarios (id, nombre, email, password_hash, telefono, ci, ci_foto_url, ci_verificado, rol, estado) VALUES
(1, 'Super Administrador', 'superadmin@donachain.com',
    '$2y$10$EjYMfSDjJlHTj9AvlehvVOUcQClpcpEio8pV7Q0737hFlXrMcTVCe', '70000001', '1000001 LP', NULL, TRUE, 'superadmin', 'activo'),
(2, 'Donante de Prueba', 'donante@test.com',
    '$2y$10$VkJwoPIe83aJpHvmETMtXu48Z54lSBugOlmKW3NrAhN36hflYD1L.', '70000002', '2000002 LP', 'uploads/ci/demo_ci.png', TRUE, 'donante', 'activo'),
(3, 'Representante Fundación Esperanza', 'fundacion@esperanza.org',
    '$2y$10$1azHXkZ980P8zrtqnt6ziOtVzTEQ5E.j09Xn6ZohY.jCOrjTnmlC6', '70000003', '3000003 LP', 'uploads/ci/demo_ci.png', TRUE, 'empresa', 'activo'),
(4, 'Administrador Conciliador', 'admin@donachain.com',
    '$2y$10$EjYMfSDjJlHTj9AvlehvVOUcQClpcpEio8pV7Q0737hFlXrMcTVCe', '70000004', '4000004 LP', NULL, TRUE, 'admin', 'activo'),
(5, 'Donante Pendiente', 'pendiente@test.com',
    '$2y$10$VkJwoPIe83aJpHvmETMtXu48Z54lSBugOlmKW3NrAhN36hflYD1L.', '70000005', '5000005 LP', 'uploads/ci/demo_ci.png', FALSE, 'donante', 'activo');

INSERT INTO organizaciones (id, id_usuario_representante, nombre_legal, nit, tipo, estado_verificacion, documento_url) VALUES
(1, 3, 'Fundación Esperanza Bolivia', '1020304050', 'Fundacion', 'aprobado', 'uploads/documentos/demo_nit.png');

INSERT INTO categorias (id, nombre, icono, descripcion) VALUES
(1, 'Salud',     'bi-heart-pulse', 'Tratamientos médicos, medicamentos e insumos hospitalarios.'),
(2, 'Educación', 'bi-book',        'Útiles escolares, becas e infraestructura educativa.');

INSERT INTO especies (id, nombre, unidad_medida) VALUES
(1, 'Arroz',          'kg'),
(2, 'Medicamentos',   'cajas'),
(3, 'Cuadernos',      'unidades'),
(4, 'Ropa de abrigo', 'prendas');

INSERT INTO campanas (id, id_organizacion, id_categoria, titulo, descripcion, meta_fondos, meta_especies, fondos_recaudados, estado, fecha_cierre, es_urgente) VALUES
(1, 1, 1, 'Medicamentos para el Hospital de El Alto',
    'Recaudación de fondos y medicamentos para pacientes de escasos recursos del Hospital del Norte.',
    15000, '200 cajas de medicamentos básicos', 0, 'activa', '2027-03-31 23:59:59', TRUE),
(2, 1, 2, 'Útiles escolares para Achacachi',
    'Kits escolares completos para estudiantes de unidades educativas rurales de la provincia Omasuyos.',
    8000, '500 cuadernos y 300 kits de útiles', 0, 'activa', '2027-02-15 23:59:59', FALSE);

INSERT INTO billeteras (id_usuario, direccion_publica, saldo, clave_privada_simulada) VALUES
(1, CONCAT('0x', SHA2('superadmin@donachain.com', 256)), 0,    SHA2('superadmin@donachain.com|priv-demo', 256)),
(2, CONCAT('0x', SHA2('donante@test.com', 256)),         1000, SHA2('donante@test.com|priv-demo', 256)),
(3, CONCAT('0x', SHA2('fundacion@esperanza.org', 256)),  0,    SHA2('fundacion@esperanza.org|priv-demo', 256)),
(4, CONCAT('0x', SHA2('admin@donachain.com', 256)),      0,    SHA2('admin@donachain.com|priv-demo', 256)),
(5, CONCAT('0x', SHA2('pendiente@test.com', 256)),       500,  SHA2('pendiente@test.com|priv-demo', 256));

INSERT INTO bloques (id, indice, `timestamp`, hash_anterior, hash_actual, nonce, dificultad, minero) VALUES
(1, 0, '2026-01-01 00:00:00', '0',
    '00fb9a7ece71b9901385f3b90054175f7decfedd789dda3b68c88d6eddfe9df5', 4, 2, 'GENESIS');

INSERT INTO donaciones (id_campana, id_usuario, tipo_donacion, monto, id_especie, cantidad_especie, estado, comprobante_url, codigo_recepcion) VALUES
(1, 2, 'efectivo', 150, NULL, NULL,  'pendiente', 'uploads/comprobantes/demo_comprobante.png', NULL),
(2, 2, 'efectivo', 80,  NULL, NULL,  'pendiente', 'uploads/comprobantes/demo_comprobante.png', NULL),
(1, 2, 'especie',  0,   2,    20.00, 'pendiente', NULL, 'DC-4F7A21');

INSERT INTO fondo_reserva (monto_total, id_admin_creador, distribuido) VALUES (5000, 1, FALSE);

INSERT INTO notificaciones (id_usuario, titulo, mensaje) VALUES
(2, '¡Bienvenido a DONA-CHAIN!', 'Tu identidad fue verificada. Ya puedes donar de forma transparente.'),
(1, 'Sistema listo', 'La base de datos y el bloque génesis fueron creados correctamente.');

INSERT INTO mensajes (id_emisor, id_receptor, id_campana, mensaje) VALUES
(2, 3, 1, 'Hola, ¿qué medicamentos necesitan con más urgencia?'),
(3, 2, 1, 'Gracias por escribir. Necesitamos sobre todo antibióticos y analgésicos.');

INSERT INTO auditoria (id_usuario, accion, descripcion, ip_address, user_agent) VALUES
(1, 'SISTEMA_INICIALIZADO', 'Instalación de la base de datos y creación del bloque génesis.', '127.0.0.1', 'database.sql');
