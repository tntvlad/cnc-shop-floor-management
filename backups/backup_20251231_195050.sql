--
-- PostgreSQL database dump
--

\restrict nnCom9RHWOxynvIh6xb7tsahLE4FwwfIeN4hFn1FJMgJYdUTFDcCGzuBfQRl6aJ

-- Dumped from database version 15.15
-- Dumped by pg_dump version 15.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: customer_contacts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_contacts (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    contact_type character varying(50) NOT NULL,
    name character varying(200) NOT NULL,
    phone character varying(50),
    email character varying(200),
    is_primary boolean DEFAULT false,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.customer_contacts OWNER TO postgres;

--
-- Name: TABLE customer_contacts; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.customer_contacts IS 'Multiple contact persons per customer by type (invoice/order/technical)';


--
-- Name: COLUMN customer_contacts.contact_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.customer_contacts.contact_type IS 'invoice, order, or technical';


--
-- Name: customer_contacts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customer_contacts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.customer_contacts_id_seq OWNER TO postgres;

--
-- Name: customer_contacts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customer_contacts_id_seq OWNED BY public.customer_contacts.id;


--
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customers (
    id integer NOT NULL,
    company_name character varying(255) NOT NULL,
    cif character varying(50),
    reg_com character varying(50),
    address text,
    city character varying(100),
    postal_code character varying(20),
    country character varying(100) DEFAULT 'Romania'::character varying,
    contact_person character varying(100),
    contact_phone character varying(20),
    contact_email character varying(100),
    email character varying(100) NOT NULL,
    phone character varying(20),
    technical_contact_person character varying(100),
    technical_phone character varying(20),
    technical_email character varying(100),
    processing_notes text,
    delivery_notes text,
    billing_notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    customer_id character varying(50),
    headquarters_address text,
    trade_register_number character varying(50),
    notes text,
    is_active boolean DEFAULT true,
    delivery_address text
);


ALTER TABLE public.customers OWNER TO postgres;

--
-- Name: TABLE customers; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.customers IS 'Master customer information with company details';


--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.customers_id_seq OWNER TO postgres;

--
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- Name: feedback; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.feedback (
    id integer NOT NULL,
    part_id integer,
    user_id integer,
    text text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.feedback OWNER TO postgres;

--
-- Name: TABLE feedback; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.feedback IS 'Employee feedback on parts';


--
-- Name: feedback_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.feedback_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.feedback_id_seq OWNER TO postgres;

--
-- Name: feedback_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.feedback_id_seq OWNED BY public.feedback.id;


--
-- Name: files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.files (
    id integer NOT NULL,
    part_id integer,
    filename character varying(255) NOT NULL,
    file_type character varying(10) NOT NULL,
    file_path character varying(500) NOT NULL,
    uploaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.files OWNER TO postgres;

--
-- Name: TABLE files; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.files IS 'Technical files (PDF, DXF, NC) associated with parts';


--
-- Name: files_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.files_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.files_id_seq OWNER TO postgres;

--
-- Name: files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.files_id_seq OWNED BY public.files.id;


--
-- Name: job_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_assignments (
    id integer NOT NULL,
    part_id integer NOT NULL,
    user_id integer NOT NULL,
    sequence integer NOT NULL,
    status character varying(50) DEFAULT 'locked'::character varying,
    assigned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    actual_time integer
);


ALTER TABLE public.job_assignments OWNER TO postgres;

--
-- Name: job_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.job_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.job_assignments_id_seq OWNER TO postgres;

--
-- Name: job_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.job_assignments_id_seq OWNED BY public.job_assignments.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    customer_id integer,
    customer_name character varying(255) NOT NULL,
    customer_email character varying(255),
    customer_phone character varying(50),
    invoice_contact_id integer,
    order_contact_id integer,
    technical_contact_id integer,
    delivery_address text,
    order_date date DEFAULT CURRENT_DATE NOT NULL,
    due_date date,
    priority character varying(20) DEFAULT 'normal'::character varying,
    status character varying(50) DEFAULT 'pending'::character varying,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.orders_id_seq OWNER TO postgres;

--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: part_completions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.part_completions (
    id integer NOT NULL,
    part_id integer,
    user_id integer,
    actual_time integer NOT NULL,
    completed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.part_completions OWNER TO postgres;

--
-- Name: TABLE part_completions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.part_completions IS 'Records of completed parts with actual vs target time';


--
-- Name: part_completions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.part_completions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.part_completions_id_seq OWNER TO postgres;

--
-- Name: part_completions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.part_completions_id_seq OWNED BY public.part_completions.id;


--
-- Name: parts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.parts (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    material character varying(50) NOT NULL,
    quantity integer NOT NULL,
    treatment character varying(100),
    target_time integer NOT NULL,
    order_position integer NOT NULL,
    completed boolean DEFAULT false,
    locked boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    file_folder text,
    customer_id integer,
    invoice_contact_id integer,
    order_contact_id integer,
    technical_contact_id integer,
    delivery_address text,
    order_id integer
);


ALTER TABLE public.parts OWNER TO postgres;

--
-- Name: TABLE parts; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.parts IS 'Manufacturing parts with specifications and sequential locking';


--
-- Name: COLUMN parts.delivery_address; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.parts.delivery_address IS 'Override delivery address for this order, defaults to customer headquarters';


--
-- Name: parts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.parts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.parts_id_seq OWNER TO postgres;

--
-- Name: parts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.parts_id_seq OWNED BY public.parts.id;


--
-- Name: time_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.time_logs (
    id integer NOT NULL,
    user_id integer,
    part_id integer,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone,
    duration integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.time_logs OWNER TO postgres;

--
-- Name: TABLE time_logs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.time_logs IS 'Tracking of time spent on parts';


--
-- Name: time_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.time_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.time_logs_id_seq OWNER TO postgres;

--
-- Name: time_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.time_logs_id_seq OWNED BY public.time_logs.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    employee_id character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    level integer DEFAULT 100,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.users IS 'Employee users with authentication credentials';


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: customer_contacts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_contacts ALTER COLUMN id SET DEFAULT nextval('public.customer_contacts_id_seq'::regclass);


--
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- Name: feedback id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feedback ALTER COLUMN id SET DEFAULT nextval('public.feedback_id_seq'::regclass);


--
-- Name: files id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.files ALTER COLUMN id SET DEFAULT nextval('public.files_id_seq'::regclass);


--
-- Name: job_assignments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_assignments ALTER COLUMN id SET DEFAULT nextval('public.job_assignments_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: part_completions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.part_completions ALTER COLUMN id SET DEFAULT nextval('public.part_completions_id_seq'::regclass);


--
-- Name: parts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parts ALTER COLUMN id SET DEFAULT nextval('public.parts_id_seq'::regclass);


--
-- Name: time_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.time_logs ALTER COLUMN id SET DEFAULT nextval('public.time_logs_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: customer_contacts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customer_contacts (id, customer_id, contact_type, name, phone, email, is_primary, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customers (id, company_name, cif, reg_com, address, city, postal_code, country, contact_person, contact_phone, contact_email, email, phone, technical_contact_person, technical_phone, technical_email, processing_notes, delivery_notes, billing_notes, created_at, updated_at, customer_id, headquarters_address, trade_register_number, notes, is_active, delivery_address) FROM stdin;
\.


--
-- Data for Name: feedback; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.feedback (id, part_id, user_id, text, created_at) FROM stdin;
\.


--
-- Data for Name: files; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.files (id, part_id, filename, file_type, file_path, uploaded_at) FROM stdin;
\.


--
-- Data for Name: job_assignments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.job_assignments (id, part_id, user_id, sequence, status, assigned_at, started_at, completed_at, actual_time) FROM stdin;
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.orders (id, customer_id, customer_name, customer_email, customer_phone, invoice_contact_id, order_contact_id, technical_contact_id, delivery_address, order_date, due_date, priority, status, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: part_completions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.part_completions (id, part_id, user_id, actual_time, completed_at) FROM stdin;
\.


--
-- Data for Name: parts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.parts (id, name, material, quantity, treatment, target_time, order_position, completed, locked, created_at, file_folder, customer_id, invoice_contact_id, order_contact_id, technical_contact_id, delivery_address, order_id) FROM stdin;
1	Bracket Mount A	Aluminum 6061	50	Anodized	120	1	f	f	2025-12-27 21:47:09.232001	\N	\N	\N	\N	\N	\N	\N
2	Shaft Connector B	Steel 4140	25	Heat Treated	180	2	f	t	2025-12-27 21:47:09.232001	\N	\N	\N	\N	\N	\N	\N
3	Housing Cover C	Aluminum 7075	30	None	90	3	f	t	2025-12-27 21:47:09.232001	\N	\N	\N	\N	\N	\N	\N
4	Gear Assembly D	Steel 1045	20	Carburized	240	4	f	t	2025-12-27 21:47:09.232001	\N	\N	\N	\N	\N	\N	\N
5	Support Plate E	Stainless 304	40	Passivated	150	5	f	t	2025-12-27 21:47:09.232001	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: time_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.time_logs (id, user_id, part_id, start_time, end_time, duration, created_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, employee_id, name, password_hash, level, created_by, created_at) FROM stdin;
1	ADMIN001	Administrator	$2b$10$v4KiJjM5GIq9dkRrekc7Nu1ZT2IHDPXZbVBppl4kdXAqxPnHEffBG	500	\N	2025-12-27 21:47:09.224103
\.


--
-- Name: customer_contacts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customer_contacts_id_seq', 1, false);


--
-- Name: customers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customers_id_seq', 1, false);


--
-- Name: feedback_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.feedback_id_seq', 1, false);


--
-- Name: files_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.files_id_seq', 1, false);


--
-- Name: job_assignments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.job_assignments_id_seq', 1, false);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.orders_id_seq', 1, false);


--
-- Name: part_completions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.part_completions_id_seq', 1, false);


--
-- Name: parts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.parts_id_seq', 5, true);


--
-- Name: time_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.time_logs_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 1, true);


--
-- Name: customer_contacts customer_contacts_customer_id_contact_type_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_contacts
    ADD CONSTRAINT customer_contacts_customer_id_contact_type_email_key UNIQUE (customer_id, contact_type, email);


--
-- Name: customer_contacts customer_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_contacts
    ADD CONSTRAINT customer_contacts_pkey PRIMARY KEY (id);


--
-- Name: customers customers_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_customer_id_key UNIQUE (customer_id);


--
-- Name: customers customers_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_email_key UNIQUE (email);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: feedback feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_pkey PRIMARY KEY (id);


--
-- Name: files files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_pkey PRIMARY KEY (id);


--
-- Name: job_assignments job_assignments_part_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_assignments
    ADD CONSTRAINT job_assignments_part_id_user_id_key UNIQUE (part_id, user_id);


--
-- Name: job_assignments job_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_assignments
    ADD CONSTRAINT job_assignments_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: part_completions part_completions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.part_completions
    ADD CONSTRAINT part_completions_pkey PRIMARY KEY (id);


--
-- Name: parts parts_order_position_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parts
    ADD CONSTRAINT parts_order_position_key UNIQUE (order_position);


--
-- Name: parts parts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parts
    ADD CONSTRAINT parts_pkey PRIMARY KEY (id);


--
-- Name: time_logs time_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.time_logs
    ADD CONSTRAINT time_logs_pkey PRIMARY KEY (id);


--
-- Name: users users_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_employee_id_key UNIQUE (employee_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_customer_contacts_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_contacts_customer_id ON public.customer_contacts USING btree (customer_id);


--
-- Name: idx_customer_contacts_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_contacts_type ON public.customer_contacts USING btree (contact_type);


--
-- Name: idx_customers_cif; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_cif ON public.customers USING btree (cif);


--
-- Name: idx_customers_company; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_company ON public.customers USING btree (company_name);


--
-- Name: idx_customers_company_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_company_name ON public.customers USING btree (company_name);


--
-- Name: idx_customers_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_email ON public.customers USING btree (email);


--
-- Name: idx_customers_phone; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_phone ON public.customers USING btree (phone);


--
-- Name: idx_feedback_part_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_feedback_part_id ON public.feedback USING btree (part_id);


--
-- Name: idx_files_part_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_files_part_id ON public.files USING btree (part_id);


--
-- Name: idx_job_assignments_part_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_assignments_part_id ON public.job_assignments USING btree (part_id);


--
-- Name: idx_job_assignments_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_assignments_status ON public.job_assignments USING btree (status);


--
-- Name: idx_job_assignments_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_assignments_user_id ON public.job_assignments USING btree (user_id);


--
-- Name: idx_orders_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_customer_id ON public.orders USING btree (customer_id);


--
-- Name: idx_orders_due_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_due_date ON public.orders USING btree (due_date);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- Name: idx_part_completions_part_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_part_completions_part_id ON public.part_completions USING btree (part_id);


--
-- Name: idx_parts_completed; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_parts_completed ON public.parts USING btree (completed);


--
-- Name: idx_parts_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_parts_customer_id ON public.parts USING btree (customer_id);


--
-- Name: idx_parts_locked; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_parts_locked ON public.parts USING btree (locked);


--
-- Name: idx_parts_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_parts_order_id ON public.parts USING btree (order_id);


--
-- Name: idx_parts_order_position; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_parts_order_position ON public.parts USING btree (order_position);


--
-- Name: idx_time_logs_part_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_time_logs_part_id ON public.time_logs USING btree (part_id);


--
-- Name: idx_time_logs_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_time_logs_user_id ON public.time_logs USING btree (user_id);


--
-- Name: customer_contacts customer_contacts_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_contacts
    ADD CONSTRAINT customer_contacts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: feedback feedback_part_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_part_id_fkey FOREIGN KEY (part_id) REFERENCES public.parts(id) ON DELETE CASCADE;


--
-- Name: feedback feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: files files_part_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_part_id_fkey FOREIGN KEY (part_id) REFERENCES public.parts(id) ON DELETE CASCADE;


--
-- Name: job_assignments job_assignments_part_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_assignments
    ADD CONSTRAINT job_assignments_part_id_fkey FOREIGN KEY (part_id) REFERENCES public.parts(id) ON DELETE CASCADE;


--
-- Name: job_assignments job_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_assignments
    ADD CONSTRAINT job_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: orders orders_invoice_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_invoice_contact_id_fkey FOREIGN KEY (invoice_contact_id) REFERENCES public.customer_contacts(id);


--
-- Name: orders orders_order_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_contact_id_fkey FOREIGN KEY (order_contact_id) REFERENCES public.customer_contacts(id);


--
-- Name: orders orders_technical_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_technical_contact_id_fkey FOREIGN KEY (technical_contact_id) REFERENCES public.customer_contacts(id);


--
-- Name: part_completions part_completions_part_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.part_completions
    ADD CONSTRAINT part_completions_part_id_fkey FOREIGN KEY (part_id) REFERENCES public.parts(id) ON DELETE CASCADE;


--
-- Name: part_completions part_completions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.part_completions
    ADD CONSTRAINT part_completions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: parts parts_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parts
    ADD CONSTRAINT parts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: parts parts_invoice_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parts
    ADD CONSTRAINT parts_invoice_contact_id_fkey FOREIGN KEY (invoice_contact_id) REFERENCES public.customer_contacts(id);


--
-- Name: parts parts_order_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parts
    ADD CONSTRAINT parts_order_contact_id_fkey FOREIGN KEY (order_contact_id) REFERENCES public.customer_contacts(id);


--
-- Name: parts parts_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parts
    ADD CONSTRAINT parts_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: parts parts_technical_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parts
    ADD CONSTRAINT parts_technical_contact_id_fkey FOREIGN KEY (technical_contact_id) REFERENCES public.customer_contacts(id);


--
-- Name: time_logs time_logs_part_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.time_logs
    ADD CONSTRAINT time_logs_part_id_fkey FOREIGN KEY (part_id) REFERENCES public.parts(id) ON DELETE CASCADE;


--
-- Name: time_logs time_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.time_logs
    ADD CONSTRAINT time_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict nnCom9RHWOxynvIh6xb7tsahLE4FwwfIeN4hFn1FJMgJYdUTFDcCGzuBfQRl6aJ

