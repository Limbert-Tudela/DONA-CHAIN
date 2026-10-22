# DONA-CHAIN
Plataforma de Donaciones Transparentes basada en Blockchain

Sistema web que permite a organizaciones sin fines de lucro registrar campañas de donación y a los donantes contribuir con fondos. Utiliza contratos inteligentes sobre blockchain para garantizar que cada donación quede registrada de forma inmutable y sea auditable públicamente. Incluye un algoritmo de Financiamiento Cuadrático para distribuir equitativamente los fondos entre campañas.

📋 Tabla de Contenidos

- [Descripción](#-descripción)
- [Problema que resuelve](#-problema-que-resuelve)
- [Arquitectura](#-arquitectura)
- [Tecnologías utilizadas](#-tecnologías-utilizadas)
- [Estructura del proyecto](#-estructura-del-proyecto)
- [Requisitos previos](#-requisitos-previos)
- [Instalación](#-instalación)
- [Uso](#-uso)
- [Pruebas](#-pruebas)
- [Metodología](#-metodología)
- [Estado del proyecto](#-estado-del-proyecto)
- [Autor](#-autor)
- [Licencia](#-licencia)

📖 Descripción

DONA-CHAIN es una plataforma descentralizada que resuelve el problema de la **falta de transparencia en las donaciones**. Cada aporte queda registrado en una red blockchain local mediante contratos inteligentes, generando un hash único e inmutable que cualquier persona puede verificar.

El sistema implementa **Financiamiento Cuadrático (Quadratic Funding)**, un algoritmo matemático que premia la cantidad de donantes sobre el monto individual, logrando una distribución más equitativa de los fondos de reserva.



🎯 Problema que resuelve

Las organizaciones sin fines de lucro gestionan sus campañas sin plataformas que certifiquen de forma inalterable la recepción de fondos. Esto genera:

- ❌ Desconfianza de los donantes
- ❌ Solicitudes con descripciones dudosas
- ❌ Distribución manual o subjetiva del dinero
- ❌ Disminución de la recaudación efectiva

Solución: Registros inmutables en blockchain, trazabilidad total y distribución algorítmica equitativa.

🛠 Tecnologías utilizadas

Blockchain
| Tecnología | Versión | Uso |
|------------|---------|-----|
| Solidity | 0.8.19 | Lenguaje de contratos inteligentes |
| Hardhat | 2.29.1 | Entorno de desarrollo blockchain |
| OpenZeppelin Contracts | 4.9.6 | Librería de contratos seguros |
| Hardhat Network | — | Red blockchain local (Chain ID 31337) |
Backend
| Tecnología | Versión | Uso |
|------------|---------|-----|
| PHP | 8.0+ | Lenguaje del backend |
| Composer | 2.x | Gestor de dependencias PHP |
| web3p/web3.php | dev-master | Cliente Web3 para PHP |
| phpseclib | 3.0.57 | Criptografía |
Frontend
| Tecnología | Uso |
|------------|-----|
| HTML5 | Estructura |
| CSS3 | Estilos (tema oscuro) |
| JavaScript | Interactividad |
Herramientas
| Herramienta | Uso |
|-------------|-----|
| Node.js + npm | Entorno de desarrollo blockchain |
| Git | Control de versiones |
| PowerShell | Terminal en Windows |

📁 Estructura del proyecto

DONA-CHAIN/
│
├── blockchain/ # Contratos inteligentes
│ ├── contracts/
│ │ ├── DONAChain.sol # Contrato principal
│ │ └── QuadraticFunding.sol # Algoritmo cuadrático
│ ├── scripts/
│ │ └── deploy.js # Script de despliegue
│ ├── test/
│ │ └── contratos.test.js # Pruebas unitarias
│ ├── hardhat.config.js
│ ├── package.json
│ └── .env
│
├── backend/ # Lógica PHP
│ ├── config/
│ │ ├── blockchain.php # Configuración de red
│ │ └── database.php # Configuración BD (Sprint 3)
│ ├── BlockchainService.php # Servicio de integración
│ ├── OptimizationService.php # Motor de optimización
│ ├── test-conexion.php # Prueba de conexión
│ ├── abi/
│ │ ├── DONAChain.json
│ │ └── QuadraticFunding.json
│ ├── vendor/ # Dependencias Composer
│ └── composer.json
│
├── frontend/ # Interfaz web
│ ├── css/
│ │ └── styles.css
│ ├── js/
│ │ ├── app.js
│ │ └── web3.js
│ ├── img/
│ └── index.html
│
├── database/ # Scripts SQL
│ └── schema.sql
│
└── README.md
