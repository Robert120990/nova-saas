CREATE DATABASE IF NOT EXISTS db_sistema_saas;
USE db_sistema_saas;

-- Roles and Permissions
CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    permissions JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Companies (Tenants)
CREATE TABLE IF NOT EXISTS companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nit VARCHAR(17) NOT NULL UNIQUE,
    nrc VARCHAR(10) NOT NULL UNIQUE,
    razon_social VARCHAR(255) NOT NULL,
    nombre_comercial VARCHAR(255),
    actividad_economica TEXT,
    codigo_actividad VARCHAR(10),
    direccion TEXT,
    departamento VARCHAR(50),
    municipio VARCHAR(50),
    correo VARCHAR(100),
    telefono VARCHAR(20),
    tipo_contribuyente ENUM('Persona Natural', 'Persona Jurídica') DEFAULT 'Persona Jurídica',
    certificado_digital TEXT,
    clave_privada TEXT,
    api_user VARCHAR(100),
    api_password VARCHAR(255),
    ambiente ENUM('test', 'produccion') DEFAULT 'test',
    logo_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Branches
CREATE TABLE IF NOT EXISTS branches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    codigo VARCHAR(10) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    tipo_establecimiento VARCHAR(10) DEFAULT '01',
    actividad_economica TEXT,
    direccion TEXT,
    departamento VARCHAR(50),
    municipio VARCHAR(50),
    telefono VARCHAR(20),
    correo VARCHAR(100),
    codigo_mh VARCHAR(10),
    logo_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE KEY (company_id, codigo)
);

-- Points of Sale (POS)
CREATE TABLE IF NOT EXISTS points_of_sale (
    id INT AUTO_INCREMENT PRIMARY KEY,
    branch_id INT NOT NULL,
    company_id INT NOT NULL,
    codigo VARCHAR(10) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    status ENUM('activo', 'inactivo') DEFAULT 'activo',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE KEY (branch_id, codigo)
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    role_id INT NOT NULL,
    username VARCHAR(50) NOT NULL,
    password VARCHAR(255) NOT NULL,
    nombre VARCHAR(100),
    email VARCHAR(100),
    status ENUM('activo', 'inactivo') DEFAULT 'activo',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id),
    UNIQUE KEY (company_id, username)
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    tipo_documento VARCHAR(20),
    numero_documento VARCHAR(20),
    nit VARCHAR(17),
    nrc VARCHAR(10),
    nombre VARCHAR(255) NOT NULL,
    nombre_comercial VARCHAR(255),
    actividad_economica TEXT,
    codigo_actividad VARCHAR(10),
    direccion TEXT,
    departamento VARCHAR(50),
    municipio VARCHAR(50),
    pais VARCHAR(50) DEFAULT 'El Salvador',
    telefono VARCHAR(20),
    correo VARCHAR(100),
    tipo_contribuyente VARCHAR(50),
    condicion_fiscal ENUM('contribuyente', 'gran contribuyente', 'exento IVA', 'exento impuestos', 'sujeto excluido') DEFAULT 'contribuyente',
    aplica_iva BOOLEAN DEFAULT TRUE,
    exento_iva BOOLEAN DEFAULT FALSE,
    aplica_fovial BOOLEAN DEFAULT FALSE,
    aplica_cotrans BOOLEAN DEFAULT FALSE,
    tipo_operacion ENUM('local', 'exportacion') DEFAULT 'local',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Providers
CREATE TABLE IF NOT EXISTS providers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    tipo_documento VARCHAR(20),
    numero_documento VARCHAR(20),
    nit VARCHAR(17),
    nrc VARCHAR(10),
    nombre VARCHAR(255) NOT NULL,
    nombre_comercial VARCHAR(255),
    id_actividad INT,
    direccion TEXT,
    departamento VARCHAR(50),
    municipio VARCHAR(50),
    telefono VARCHAR(20),
    correo VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Products
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    codigo VARCHAR(50) NOT NULL,
    descripcion VARCHAR(255) NOT NULL,
    precio DECIMAL(18, 6) NOT NULL,
    unidad_medida VARCHAR(20) DEFAULT 'unidad',
    tipo_producto ENUM('bien', 'servicio') DEFAULT 'bien',
    categoria VARCHAR(100),
    provider_id INT,
    afecto_iva BOOLEAN DEFAULT TRUE,
    exento_iva BOOLEAN DEFAULT FALSE,
    aplica_fovial BOOLEAN DEFAULT FALSE,
    aplica_cotrans BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE SET NULL,
    UNIQUE KEY (company_id, codigo)
);

-- Product Availability (Branch)
CREATE TABLE IF NOT EXISTS product_branch (
    product_id INT NOT NULL,
    branch_id INT NOT NULL,
    PRIMARY KEY (product_id, branch_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
);

-- Product Availability (POS)
CREATE TABLE IF NOT EXISTS product_pos (
    product_id INT NOT NULL,
    pos_id INT NOT NULL,
    PRIMARY KEY (product_id, pos_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (pos_id) REFERENCES points_of_sale(id) ON DELETE CASCADE
);

-- Inventory
CREATE TABLE IF NOT EXISTS inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    branch_id INT NOT NULL,
    stock DECIMAL(18, 6) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    UNIQUE KEY (product_id, branch_id)
);

-- Seeding initial roles and an admin user (example)
INSERT INTO roles (name, permissions) VALUES ('SuperAdmin', '{"all": true}');
INSERT INTO roles (name, permissions) VALUES ('Admin', '{"all": true}');
INSERT INTO roles (name, permissions) VALUES ('Vendedor', '{"sales": true}');

-- Seed a default company and admin user for testing
INSERT INTO companies (nit, nrc, razon_social, nombre_comercial, ambiente) 
VALUES ('0000-000000-000-0', '00000-0', 'Empresa Demo SA de CV', 'Demo SaaS', 'test');

INSERT INTO users (company_id, role_id, username, password, nombre, email)
VALUES (1, 1, 'admin', '$2b$10$EpjXfo.TdOQ8WzjXmP/Lbu.69b7.G/qS.E5.q9.E1.q9.E1.q9.E1', 'Administrador Sistema', 'admin@example.com');
-- Password is 'admin123' (hashed placeholder)
