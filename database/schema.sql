-- LA-Sistemas ERP - schema inicial
-- Banco relacional preparado para evolução do ERP.

CREATE TABLE users (
    id BIGINT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(180) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE roles (
    id BIGINT PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,
    description VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_roles (
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE customers (
    id BIGINT PRIMARY KEY,
    name VARCHAR(180) NOT NULL,
    document VARCHAR(30),
    email VARCHAR(180),
    phone VARCHAR(40),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE suppliers (
    id BIGINT PRIMARY KEY,
    name VARCHAR(180) NOT NULL,
    document VARCHAR(30),
    email VARCHAR(180),
    phone VARCHAR(40),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    id BIGINT PRIMARY KEY,
    code VARCHAR(60) NOT NULL UNIQUE,
    name VARCHAR(180) NOT NULL,
    description TEXT,
    unit VARCHAR(20) NOT NULL DEFAULT 'UN',
    cost DECIMAL(15,2) NOT NULL DEFAULT 0,
    sale_price DECIMAL(15,2) NOT NULL DEFAULT 0,
    ncm VARCHAR(8),
    cest VARCHAR(7),
    cfop VARCHAR(4),
    tax_code_type VARCHAR(5),
    tax_code VARCHAR(4),
    origin SMALLINT,
    gtin VARCHAR(14),
    gtin_trib VARCHAR(14),
    tax_unit VARCHAR(20),
    icms_rate DECIMAL(7,4) NOT NULL DEFAULT 0,
    pis_cst VARCHAR(2),
    pis_rate DECIMAL(7,4) NOT NULL DEFAULT 0,
    cofins_cst VARCHAR(2),
    cofins_rate DECIMAL(7,4) NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE stock (
    product_id BIGINT PRIMARY KEY,
    quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
    minimum_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE stock_movements (
    id BIGINT PRIMARY KEY,
    product_id BIGINT NOT NULL,
    type VARCHAR(20) NOT NULL,
    quantity DECIMAL(15,3) NOT NULL,
    reference VARCHAR(100),
    notes VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE sales (
    id BIGINT PRIMARY KEY,
    customer_id BIGINT,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    total DECIMAL(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE sale_items (
    id BIGINT PRIMARY KEY,
    sale_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity DECIMAL(15,3) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    total DECIMAL(15,2) NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE purchases (
    id BIGINT PRIMARY KEY,
    supplier_id BIGINT,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    total DECIMAL(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE purchase_items (
    id BIGINT PRIMARY KEY,
    purchase_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity DECIMAL(15,3) NOT NULL,
    unit_cost DECIMAL(15,2) NOT NULL,
    total DECIMAL(15,2) NOT NULL,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE financial_entries (
    id BIGINT PRIMARY KEY,
    type VARCHAR(20) NOT NULL,
    description VARCHAR(255) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    due_date DATE,
    paid_at TIMESTAMP,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    customer_id BIGINT,
    supplier_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_ncm ON products(ncm);
CREATE INDEX idx_products_gtin ON products(gtin);
CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_suppliers_name ON suppliers(name);
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_financial_entries_due_date ON financial_entries(due_date);
