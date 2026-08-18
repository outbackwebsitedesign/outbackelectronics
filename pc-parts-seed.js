// Built-in PC component catalog.
//
// Ships in code (unlike pc-builder.db, which is gitignored and starts empty on
// a fresh deploy) so the parts library has real components in it before any
// supplier feed is connected. Loading it is idempotent: entries are keyed by
// seedId, so re-running an import updates the specs and never duplicates.
//
// Two rules govern what goes in here:
//
// 1. Prices are deliberately absent. Component specs are stable for the life of
//    the part, prices are not, so pricing comes from the catalog or a supplier
//    feed and this file never competes with it.
//
// 2. A spec is filled in only where it is a property of the part itself. Where
//    a figure varies by board partner, revision or retailer bundle it is left
//    unset on purpose. checkBuild() skips a rule whose inputs are missing and
//    says so, which is the honest outcome; a guessed number would instead be
//    reported to staff as a fact. The clearest case is GPU length, which is a
//    property of the specific card (an ASUS TUF and an MSI Ventus of the same
//    chip differ by tens of millimetres), not of the GPU, so it is left for
//    whoever adds the card they are actually quoting.
//
// Physical dimensions on cases and coolers are the specs most worth spot
// checking against the manufacturer page before a build is quoted on them.

// Intel 12th to 14th generation run either DDR4 or DDR5 depending on the board,
// so memoryType is intentionally unset on those: the board decides, and the
// compatibility check reads it from there.

const CPUS = [
  // AMD AM5, DDR5 only. Every Ryzen 7000/9000 desktop part has an RDNA2 iGPU.
  { seedId:'cpu-amd-7600',     brand:'AMD', name:'Ryzen 5 7600',      specs:{ socket:'AM5', memoryType:'DDR5', tdp:65,  cores:6,  integratedGraphics:true, coolerIncluded:true } },
  { seedId:'cpu-amd-7600x',    brand:'AMD', name:'Ryzen 5 7600X',     specs:{ socket:'AM5', memoryType:'DDR5', tdp:105, cores:6,  integratedGraphics:true, coolerIncluded:false } },
  { seedId:'cpu-amd-7700',     brand:'AMD', name:'Ryzen 7 7700',      specs:{ socket:'AM5', memoryType:'DDR5', tdp:65,  cores:8,  integratedGraphics:true, coolerIncluded:true } },
  { seedId:'cpu-amd-7700x',    brand:'AMD', name:'Ryzen 7 7700X',     specs:{ socket:'AM5', memoryType:'DDR5', tdp:105, cores:8,  integratedGraphics:true, coolerIncluded:false } },
  { seedId:'cpu-amd-7800x3d',  brand:'AMD', name:'Ryzen 7 7800X3D',   specs:{ socket:'AM5', memoryType:'DDR5', tdp:120, cores:8,  integratedGraphics:true, coolerIncluded:false } },
  { seedId:'cpu-amd-7900',     brand:'AMD', name:'Ryzen 9 7900',      specs:{ socket:'AM5', memoryType:'DDR5', tdp:65,  cores:12, integratedGraphics:true, coolerIncluded:true } },
  { seedId:'cpu-amd-7900x',    brand:'AMD', name:'Ryzen 9 7900X',     specs:{ socket:'AM5', memoryType:'DDR5', tdp:170, cores:12, integratedGraphics:true, coolerIncluded:false } },
  { seedId:'cpu-amd-7950x',    brand:'AMD', name:'Ryzen 9 7950X',     specs:{ socket:'AM5', memoryType:'DDR5', tdp:170, cores:16, integratedGraphics:true, coolerIncluded:false } },
  { seedId:'cpu-amd-7950x3d',  brand:'AMD', name:'Ryzen 9 7950X3D',   specs:{ socket:'AM5', memoryType:'DDR5', tdp:120, cores:16, integratedGraphics:true, coolerIncluded:false } },
  { seedId:'cpu-amd-9600x',    brand:'AMD', name:'Ryzen 5 9600X',     specs:{ socket:'AM5', memoryType:'DDR5', tdp:65,  cores:6,  integratedGraphics:true, coolerIncluded:false } },
  { seedId:'cpu-amd-9700x',    brand:'AMD', name:'Ryzen 7 9700X',     specs:{ socket:'AM5', memoryType:'DDR5', tdp:65,  cores:8,  integratedGraphics:true, coolerIncluded:false } },
  { seedId:'cpu-amd-9800x3d',  brand:'AMD', name:'Ryzen 7 9800X3D',   specs:{ socket:'AM5', memoryType:'DDR5', tdp:120, cores:8,  integratedGraphics:true, coolerIncluded:false } },
  { seedId:'cpu-amd-9900x',    brand:'AMD', name:'Ryzen 9 9900X',     specs:{ socket:'AM5', memoryType:'DDR5', tdp:120, cores:12, integratedGraphics:true, coolerIncluded:false } },
  { seedId:'cpu-amd-9950x',    brand:'AMD', name:'Ryzen 9 9950X',     specs:{ socket:'AM5', memoryType:'DDR5', tdp:170, cores:16, integratedGraphics:true, coolerIncluded:false } },
  { seedId:'cpu-amd-9950x3d',  brand:'AMD', name:'Ryzen 9 9950X3D',   specs:{ socket:'AM5', memoryType:'DDR5', tdp:170, cores:16, integratedGraphics:true, coolerIncluded:false } },

  // AMD AM4, DDR4. Only the G parts carry integrated graphics.
  { seedId:'cpu-amd-5600',     brand:'AMD', name:'Ryzen 5 5600',      specs:{ socket:'AM4', memoryType:'DDR4', tdp:65,  cores:6,  integratedGraphics:false, coolerIncluded:true } },
  { seedId:'cpu-amd-5600x',    brand:'AMD', name:'Ryzen 5 5600X',     specs:{ socket:'AM4', memoryType:'DDR4', tdp:65,  cores:6,  integratedGraphics:false, coolerIncluded:true } },
  { seedId:'cpu-amd-5600g',    brand:'AMD', name:'Ryzen 5 5600G',     specs:{ socket:'AM4', memoryType:'DDR4', tdp:65,  cores:6,  integratedGraphics:true,  coolerIncluded:true } },
  { seedId:'cpu-amd-5700x',    brand:'AMD', name:'Ryzen 7 5700X',     specs:{ socket:'AM4', memoryType:'DDR4', tdp:65,  cores:8,  integratedGraphics:false, coolerIncluded:false } },
  { seedId:'cpu-amd-5700g',    brand:'AMD', name:'Ryzen 7 5700G',     specs:{ socket:'AM4', memoryType:'DDR4', tdp:65,  cores:8,  integratedGraphics:true,  coolerIncluded:true } },
  { seedId:'cpu-amd-5800x',    brand:'AMD', name:'Ryzen 7 5800X',     specs:{ socket:'AM4', memoryType:'DDR4', tdp:105, cores:8,  integratedGraphics:false, coolerIncluded:false } },
  { seedId:'cpu-amd-5800x3d',  brand:'AMD', name:'Ryzen 7 5800X3D',   specs:{ socket:'AM4', memoryType:'DDR4', tdp:105, cores:8,  integratedGraphics:false, coolerIncluded:false } },
  { seedId:'cpu-amd-5900x',    brand:'AMD', name:'Ryzen 9 5900X',     specs:{ socket:'AM4', memoryType:'DDR4', tdp:105, cores:12, integratedGraphics:false, coolerIncluded:false } },
  { seedId:'cpu-amd-5950x',    brand:'AMD', name:'Ryzen 9 5950X',     specs:{ socket:'AM4', memoryType:'DDR4', tdp:105, cores:16, integratedGraphics:false, coolerIncluded:false } },

  // Intel LGA1700. memoryType left unset: these run DDR4 or DDR5 by board.
  { seedId:'cpu-intel-12400f',  brand:'Intel', name:'Core i5-12400F',  specs:{ socket:'LGA1700', tdp:65,  cores:6,  integratedGraphics:false, coolerIncluded:true } },
  { seedId:'cpu-intel-12600k',  brand:'Intel', name:'Core i5-12600K',  specs:{ socket:'LGA1700', tdp:125, cores:10, integratedGraphics:true,  coolerIncluded:false } },
  { seedId:'cpu-intel-13400f',  brand:'Intel', name:'Core i5-13400F',  specs:{ socket:'LGA1700', tdp:65,  cores:10, integratedGraphics:false, coolerIncluded:true } },
  { seedId:'cpu-intel-13600k',  brand:'Intel', name:'Core i5-13600K',  specs:{ socket:'LGA1700', tdp:125, cores:14, integratedGraphics:true,  coolerIncluded:false } },
  { seedId:'cpu-intel-13700k',  brand:'Intel', name:'Core i7-13700K',  specs:{ socket:'LGA1700', tdp:125, cores:16, integratedGraphics:true,  coolerIncluded:false } },
  { seedId:'cpu-intel-13900k',  brand:'Intel', name:'Core i9-13900K',  specs:{ socket:'LGA1700', tdp:125, cores:24, integratedGraphics:true,  coolerIncluded:false } },
  { seedId:'cpu-intel-14600k',  brand:'Intel', name:'Core i5-14600K',  specs:{ socket:'LGA1700', tdp:125, cores:14, integratedGraphics:true,  coolerIncluded:false } },
  { seedId:'cpu-intel-14700k',  brand:'Intel', name:'Core i7-14700K',  specs:{ socket:'LGA1700', tdp:125, cores:20, integratedGraphics:true,  coolerIncluded:false } },
  { seedId:'cpu-intel-14900k',  brand:'Intel', name:'Core i9-14900K',  specs:{ socket:'LGA1700', tdp:125, cores:24, integratedGraphics:true,  coolerIncluded:false } },

  // Intel LGA1851 (Core Ultra 200S), DDR5 only.
  { seedId:'cpu-intel-u5-245k', brand:'Intel', name:'Core Ultra 5 245K', specs:{ socket:'LGA1851', memoryType:'DDR5', tdp:125, cores:14, integratedGraphics:true, coolerIncluded:false } },
  { seedId:'cpu-intel-u7-265k', brand:'Intel', name:'Core Ultra 7 265K', specs:{ socket:'LGA1851', memoryType:'DDR5', tdp:125, cores:20, integratedGraphics:true, coolerIncluded:false } },
  { seedId:'cpu-intel-u9-285k', brand:'Intel', name:'Core Ultra 9 285K', specs:{ socket:'LGA1851', memoryType:'DDR5', tdp:125, cores:24, integratedGraphics:true, coolerIncluded:false } },
];

// Motherboards. Socket, chipset, form factor, memory generation and DIMM count
// are properties of the board and are filled in. M.2 and SATA port counts vary
// between models sharing a chipset, and max memory moves with BIOS revisions,
// so both are left for whoever adds the exact board.
const MOTHERBOARDS = [
  // AM5 / DDR5
  { seedId:'mb-a620m',      brand:'Generic', name:'A620M (Micro-ATX)',      specs:{ socket:'AM5', chipset:'A620',  formFactor:'Micro-ATX', memoryType:'DDR5', memorySlots:4, pcieX16Slots:1 } },
  { seedId:'mb-b650m',      brand:'Generic', name:'B650M (Micro-ATX)',      specs:{ socket:'AM5', chipset:'B650',  formFactor:'Micro-ATX', memoryType:'DDR5', memorySlots:4, pcieX16Slots:1 } },
  { seedId:'mb-b650-atx',   brand:'Generic', name:'B650 (ATX)',             specs:{ socket:'AM5', chipset:'B650',  formFactor:'ATX',       memoryType:'DDR5', memorySlots:4, pcieX16Slots:1 } },
  { seedId:'mb-b650e-atx',  brand:'Generic', name:'B650E (ATX)',            specs:{ socket:'AM5', chipset:'B650E', formFactor:'ATX',       memoryType:'DDR5', memorySlots:4, pcieX16Slots:1 } },
  { seedId:'mb-b650-itx',   brand:'Generic', name:'B650 (Mini-ITX)',        specs:{ socket:'AM5', chipset:'B650',  formFactor:'Mini-ITX',  memoryType:'DDR5', memorySlots:2, pcieX16Slots:1 } },
  { seedId:'mb-x670e-atx',  brand:'Generic', name:'X670E (ATX)',            specs:{ socket:'AM5', chipset:'X670E', formFactor:'ATX',       memoryType:'DDR5', memorySlots:4, pcieX16Slots:2 } },
  { seedId:'mb-b850-atx',   brand:'Generic', name:'B850 (ATX)',             specs:{ socket:'AM5', chipset:'B850',  formFactor:'ATX',       memoryType:'DDR5', memorySlots:4, pcieX16Slots:1 } },
  { seedId:'mb-x870e-atx',  brand:'Generic', name:'X870E (ATX)',            specs:{ socket:'AM5', chipset:'X870E', formFactor:'ATX',       memoryType:'DDR5', memorySlots:4, pcieX16Slots:2 } },

  // AM4 / DDR4
  { seedId:'mb-a520m',      brand:'Generic', name:'A520M (Micro-ATX)',      specs:{ socket:'AM4', chipset:'A520',  formFactor:'Micro-ATX', memoryType:'DDR4', memorySlots:2, pcieX16Slots:1 } },
  { seedId:'mb-b450m',      brand:'Generic', name:'B450M (Micro-ATX)',      specs:{ socket:'AM4', chipset:'B450',  formFactor:'Micro-ATX', memoryType:'DDR4', memorySlots:4, pcieX16Slots:1 } },
  { seedId:'mb-b550m',      brand:'Generic', name:'B550M (Micro-ATX)',      specs:{ socket:'AM4', chipset:'B550',  formFactor:'Micro-ATX', memoryType:'DDR4', memorySlots:4, pcieX16Slots:1 } },
  { seedId:'mb-b550-atx',   brand:'Generic', name:'B550 (ATX)',             specs:{ socket:'AM4', chipset:'B550',  formFactor:'ATX',       memoryType:'DDR4', memorySlots:4, pcieX16Slots:1 } },
  { seedId:'mb-b550-itx',   brand:'Generic', name:'B550 (Mini-ITX)',        specs:{ socket:'AM4', chipset:'B550',  formFactor:'Mini-ITX',  memoryType:'DDR4', memorySlots:2, pcieX16Slots:1 } },
  { seedId:'mb-x570-atx',   brand:'Generic', name:'X570 (ATX)',             specs:{ socket:'AM4', chipset:'X570',  formFactor:'ATX',       memoryType:'DDR4', memorySlots:4, pcieX16Slots:2 } },

  // LGA1700. DDR4 and DDR5 variants are separate boards, so both are listed.
  { seedId:'mb-h610m-d4',   brand:'Generic', name:'H610M DDR4 (Micro-ATX)', specs:{ socket:'LGA1700', chipset:'H610', formFactor:'Micro-ATX', memoryType:'DDR4', memorySlots:2, pcieX16Slots:1 } },
  { seedId:'mb-b660m-d4',   brand:'Generic', name:'B660M DDR4 (Micro-ATX)', specs:{ socket:'LGA1700', chipset:'B660', formFactor:'Micro-ATX', memoryType:'DDR4', memorySlots:4, pcieX16Slots:1 } },
  { seedId:'mb-b760m-d4',   brand:'Generic', name:'B760M DDR4 (Micro-ATX)', specs:{ socket:'LGA1700', chipset:'B760', formFactor:'Micro-ATX', memoryType:'DDR4', memorySlots:4, pcieX16Slots:1 } },
  { seedId:'mb-b760m-d5',   brand:'Generic', name:'B760M DDR5 (Micro-ATX)', specs:{ socket:'LGA1700', chipset:'B760', formFactor:'Micro-ATX', memoryType:'DDR5', memorySlots:4, pcieX16Slots:1 } },
  { seedId:'mb-b760-d5',    brand:'Generic', name:'B760 DDR5 (ATX)',        specs:{ socket:'LGA1700', chipset:'B760', formFactor:'ATX',       memoryType:'DDR5', memorySlots:4, pcieX16Slots:1 } },
  { seedId:'mb-z790-d5',    brand:'Generic', name:'Z790 DDR5 (ATX)',        specs:{ socket:'LGA1700', chipset:'Z790', formFactor:'ATX',       memoryType:'DDR5', memorySlots:4, pcieX16Slots:2 } },
  { seedId:'mb-z790-itx',   brand:'Generic', name:'Z790 DDR5 (Mini-ITX)',   specs:{ socket:'LGA1700', chipset:'Z790', formFactor:'Mini-ITX',  memoryType:'DDR5', memorySlots:2, pcieX16Slots:1 } },

  // LGA1851 / DDR5 only
  { seedId:'mb-b860-d5',    brand:'Generic', name:'B860 (ATX)',             specs:{ socket:'LGA1851', chipset:'B860', formFactor:'ATX',      memoryType:'DDR5', memorySlots:4, pcieX16Slots:1 } },
  { seedId:'mb-z890-d5',    brand:'Generic', name:'Z890 (ATX)',             specs:{ socket:'LGA1851', chipset:'Z890', formFactor:'ATX',      memoryType:'DDR5', memorySlots:4, pcieX16Slots:2 } },
];

// Graphics cards. TDP and power connectors are properties of the chip and its
// reference design and are filled in. Length, slot width and cooler size are
// properties of the individual board partner card, not the GPU, so they are
// left unset: add the exact card being quoted and set its length there, which
// is what the case clearance check reads.
const GPUS = [
  { seedId:'gpu-rtx-3050',      brand:'NVIDIA', name:'GeForce RTX 3050 (8GB)',     specs:{ tdp:130, pcie8pin:1 } },
  { seedId:'gpu-rtx-3060',      brand:'NVIDIA', name:'GeForce RTX 3060 (12GB)',    specs:{ tdp:170, pcie8pin:1 } },
  { seedId:'gpu-rtx-4060',      brand:'NVIDIA', name:'GeForce RTX 4060',           specs:{ tdp:115, pcie8pin:1 } },
  { seedId:'gpu-rtx-4060ti',    brand:'NVIDIA', name:'GeForce RTX 4060 Ti',        specs:{ tdp:160, pcie8pin:1 } },
  { seedId:'gpu-rtx-4070',      brand:'NVIDIA', name:'GeForce RTX 4070',           specs:{ tdp:200, pcie8pin:2 } },
  { seedId:'gpu-rtx-4070s',     brand:'NVIDIA', name:'GeForce RTX 4070 SUPER',     specs:{ tdp:220, pcie8pin:2 } },
  { seedId:'gpu-rtx-4070tis',   brand:'NVIDIA', name:'GeForce RTX 4070 Ti SUPER',  specs:{ tdp:285, pcie8pin:2 } },
  { seedId:'gpu-rtx-4080s',     brand:'NVIDIA', name:'GeForce RTX 4080 SUPER',     specs:{ tdp:320, pcie12vhpwr:true } },
  { seedId:'gpu-rtx-4090',      brand:'NVIDIA', name:'GeForce RTX 4090',           specs:{ tdp:450, pcie12vhpwr:true } },
  { seedId:'gpu-rtx-5060',      brand:'NVIDIA', name:'GeForce RTX 5060',           specs:{ tdp:145, pcie8pin:1 } },
  { seedId:'gpu-rtx-5060ti',    brand:'NVIDIA', name:'GeForce RTX 5060 Ti',        specs:{ tdp:180, pcie8pin:1 } },
  { seedId:'gpu-rtx-5070',      brand:'NVIDIA', name:'GeForce RTX 5070',           specs:{ tdp:250, pcie12vhpwr:true } },
  { seedId:'gpu-rtx-5070ti',    brand:'NVIDIA', name:'GeForce RTX 5070 Ti',        specs:{ tdp:300, pcie12vhpwr:true } },
  { seedId:'gpu-rtx-5080',      brand:'NVIDIA', name:'GeForce RTX 5080',           specs:{ tdp:360, pcie12vhpwr:true } },
  { seedId:'gpu-rtx-5090',      brand:'NVIDIA', name:'GeForce RTX 5090',           specs:{ tdp:575, pcie12vhpwr:true } },
  { seedId:'gpu-rx-6600',       brand:'AMD',    name:'Radeon RX 6600',             specs:{ tdp:132, pcie8pin:1 } },
  { seedId:'gpu-rx-6700xt',     brand:'AMD',    name:'Radeon RX 6700 XT',          specs:{ tdp:230, pcie8pin:2 } },
  { seedId:'gpu-rx-7600',       brand:'AMD',    name:'Radeon RX 7600',             specs:{ tdp:165, pcie8pin:1 } },
  { seedId:'gpu-rx-7700xt',     brand:'AMD',    name:'Radeon RX 7700 XT',          specs:{ tdp:245, pcie8pin:2 } },
  { seedId:'gpu-rx-7800xt',     brand:'AMD',    name:'Radeon RX 7800 XT',          specs:{ tdp:263, pcie8pin:2 } },
  { seedId:'gpu-rx-7900xt',     brand:'AMD',    name:'Radeon RX 7900 XT',          specs:{ tdp:315, pcie8pin:2 } },
  { seedId:'gpu-rx-9070',       brand:'AMD',    name:'Radeon RX 9070',             specs:{ tdp:220, pcie8pin:2 } },
  { seedId:'gpu-rx-9070xt',     brand:'AMD',    name:'Radeon RX 9070 XT',          specs:{ tdp:304, pcie8pin:2 } },
  { seedId:'gpu-arc-b580',      brand:'Intel',  name:'Arc B580',                   specs:{ tdp:190, pcie8pin:1 } },
];

// Memory kits. Every spec here is stated in the product itself.
const RAM = [
  { seedId:'ram-ddr5-16-2x8-5600',   brand:'Generic', name:'16GB (2x8GB) DDR5-5600',   specs:{ memoryType:'DDR5', moduleCount:2, capacityGb:16,  speedMhz:5600 } },
  { seedId:'ram-ddr5-32-2x16-5600',  brand:'Generic', name:'32GB (2x16GB) DDR5-5600',  specs:{ memoryType:'DDR5', moduleCount:2, capacityGb:32,  speedMhz:5600 } },
  { seedId:'ram-ddr5-32-2x16-6000',  brand:'Generic', name:'32GB (2x16GB) DDR5-6000',  specs:{ memoryType:'DDR5', moduleCount:2, capacityGb:32,  speedMhz:6000 } },
  { seedId:'ram-ddr5-64-2x32-6000',  brand:'Generic', name:'64GB (2x32GB) DDR5-6000',  specs:{ memoryType:'DDR5', moduleCount:2, capacityGb:64,  speedMhz:6000 } },
  { seedId:'ram-ddr5-96-2x48-5600',  brand:'Generic', name:'96GB (2x48GB) DDR5-5600',  specs:{ memoryType:'DDR5', moduleCount:2, capacityGb:96,  speedMhz:5600 } },
  { seedId:'ram-ddr5-128-4x32-5600', brand:'Generic', name:'128GB (4x32GB) DDR5-5600', specs:{ memoryType:'DDR5', moduleCount:4, capacityGb:128, speedMhz:5600 } },
  { seedId:'ram-ddr4-16-2x8-3200',   brand:'Generic', name:'16GB (2x8GB) DDR4-3200',   specs:{ memoryType:'DDR4', moduleCount:2, capacityGb:16,  speedMhz:3200 } },
  { seedId:'ram-ddr4-32-2x16-3200',  brand:'Generic', name:'32GB (2x16GB) DDR4-3200',  specs:{ memoryType:'DDR4', moduleCount:2, capacityGb:32,  speedMhz:3200 } },
  { seedId:'ram-ddr4-32-2x16-3600',  brand:'Generic', name:'32GB (2x16GB) DDR4-3600',  specs:{ memoryType:'DDR4', moduleCount:2, capacityGb:32,  speedMhz:3600 } },
  { seedId:'ram-ddr4-64-4x16-3200',  brand:'Generic', name:'64GB (4x16GB) DDR4-3200',  specs:{ memoryType:'DDR4', moduleCount:4, capacityGb:64,  speedMhz:3200 } },
];

const STORAGE = [
  { seedId:'ssd-nvme-500',   brand:'Generic', name:'500GB NVMe M.2 SSD',   specs:{ interface:'M.2 NVMe', driveSize:'M.2',  capacityGb:500 } },
  { seedId:'ssd-nvme-1t',    brand:'Generic', name:'1TB NVMe M.2 SSD',     specs:{ interface:'M.2 NVMe', driveSize:'M.2',  capacityGb:1000 } },
  { seedId:'ssd-nvme-2t',    brand:'Generic', name:'2TB NVMe M.2 SSD',     specs:{ interface:'M.2 NVMe', driveSize:'M.2',  capacityGb:2000 } },
  { seedId:'ssd-nvme-4t',    brand:'Generic', name:'4TB NVMe M.2 SSD',     specs:{ interface:'M.2 NVMe', driveSize:'M.2',  capacityGb:4000 } },
  { seedId:'ssd-sata-500',   brand:'Generic', name:'500GB 2.5" SATA SSD',  specs:{ interface:'SATA',     driveSize:'2.5"', capacityGb:500 } },
  { seedId:'ssd-sata-1t',    brand:'Generic', name:'1TB 2.5" SATA SSD',    specs:{ interface:'SATA',     driveSize:'2.5"', capacityGb:1000 } },
  { seedId:'ssd-sata-2t',    brand:'Generic', name:'2TB 2.5" SATA SSD',    specs:{ interface:'SATA',     driveSize:'2.5"', capacityGb:2000 } },
  { seedId:'hdd-1t',         brand:'Generic', name:'1TB 3.5" HDD',         specs:{ interface:'SATA',     driveSize:'3.5"', capacityGb:1000 } },
  { seedId:'hdd-2t',         brand:'Generic', name:'2TB 3.5" HDD',         specs:{ interface:'SATA',     driveSize:'3.5"', capacityGb:2000 } },
  { seedId:'hdd-4t',         brand:'Generic', name:'4TB 3.5" HDD',         specs:{ interface:'SATA',     driveSize:'3.5"', capacityGb:4000 } },
  { seedId:'hdd-8t',         brand:'Generic', name:'8TB 3.5" HDD',         specs:{ interface:'SATA',     driveSize:'3.5"', capacityGb:8000 } },
];

// Power supplies. Wattage, form factor and connector count are stated on the
// unit. Physical depth varies between models at the same wattage and is left
// unset, it only matters in small cases and is worth checking there.
const PSUS = [
  { seedId:'psu-450-atx',   brand:'Generic', name:'450W ATX 80+ Bronze',  specs:{ wattage:450,  formFactor:'ATX', efficiency:'80+ Bronze', pcie8pin:1 } },
  { seedId:'psu-550-atx',   brand:'Generic', name:'550W ATX 80+ Bronze',  specs:{ wattage:550,  formFactor:'ATX', efficiency:'80+ Bronze', pcie8pin:2 } },
  { seedId:'psu-650-atx',   brand:'Generic', name:'650W ATX 80+ Gold',    specs:{ wattage:650,  formFactor:'ATX', efficiency:'80+ Gold',   pcie8pin:2 } },
  { seedId:'psu-750-atx',   brand:'Generic', name:'750W ATX 80+ Gold',    specs:{ wattage:750,  formFactor:'ATX', efficiency:'80+ Gold',   pcie8pin:4 } },
  { seedId:'psu-850-atx',   brand:'Generic', name:'850W ATX 80+ Gold',    specs:{ wattage:850,  formFactor:'ATX', efficiency:'80+ Gold',   pcie8pin:4, pcie12vhpwr:true } },
  { seedId:'psu-1000-atx',  brand:'Generic', name:'1000W ATX 80+ Gold',   specs:{ wattage:1000, formFactor:'ATX', efficiency:'80+ Gold',   pcie8pin:6, pcie12vhpwr:true } },
  { seedId:'psu-1200-atx',  brand:'Generic', name:'1200W ATX 80+ Platinum', specs:{ wattage:1200, formFactor:'ATX', efficiency:'80+ Platinum', pcie8pin:6, pcie12vhpwr:true } },
  { seedId:'psu-1600-atx',  brand:'Generic', name:'1600W ATX 80+ Titanium', specs:{ wattage:1600, formFactor:'ATX', efficiency:'80+ Titanium', pcie8pin:8, pcie12vhpwr:true } },
  { seedId:'psu-650-sfx',   brand:'Generic', name:'650W SFX 80+ Gold',    specs:{ wattage:650,  formFactor:'SFX', efficiency:'80+ Gold',   pcie8pin:2 } },
  { seedId:'psu-750-sfx',   brand:'Generic', name:'750W SFX 80+ Gold',    specs:{ wattage:750,  formFactor:'SFX', efficiency:'80+ Gold',   pcie8pin:3 } },
  { seedId:'psu-850-sfxl',  brand:'Generic', name:'850W SFX-L 80+ Gold',  specs:{ wattage:850,  formFactor:'SFX-L', efficiency:'80+ Gold', pcie8pin:4, pcie12vhpwr:true } },
];

// Cases. These clearances are what the fit checks read, and they are the specs
// most likely to have shifted between revisions of the same model, so every
// entry is flagged verify:true and surfaces an "unverified" badge in the parts
// library until a staff member has checked it against the manufacturer page.
const CASES = [
  { seedId:'case-4000d-airflow', brand:'Corsair', name:'4000D Airflow', verify:true,
    specs:{ maxBoardFormFactor:'ATX', maxGpuLengthMm:360, maxCoolerHeightMm:170, maxPsuLengthMm:180, psuFormFactor:'ATX', radiatorMm:360, bays35:2, bays25:2, fanMounts:6, fansIncluded:2 } },
  { seedId:'case-5000d-airflow', brand:'Corsair', name:'5000D Airflow', verify:true,
    specs:{ maxBoardFormFactor:'E-ATX', maxGpuLengthMm:420, maxCoolerHeightMm:170, maxPsuLengthMm:180, psuFormFactor:'ATX', radiatorMm:360, bays35:2, bays25:4, fanMounts:10, fansIncluded:2 } },
  { seedId:'case-north',         brand:'Fractal Design', name:'North', verify:true,
    specs:{ maxBoardFormFactor:'ATX', maxGpuLengthMm:355, maxCoolerHeightMm:170, psuFormFactor:'ATX', radiatorMm:360, bays35:2, bays25:2, fanMounts:6, fansIncluded:3 } },
  { seedId:'case-meshify-2',     brand:'Fractal Design', name:'Meshify 2', verify:true,
    specs:{ maxBoardFormFactor:'E-ATX', maxGpuLengthMm:360, maxCoolerHeightMm:185, psuFormFactor:'ATX', radiatorMm:360, bays35:4, bays25:2, fanMounts:9, fansIncluded:3 } },
  { seedId:'case-define-7',      brand:'Fractal Design', name:'Define 7', verify:true,
    specs:{ maxBoardFormFactor:'E-ATX', maxGpuLengthMm:360, maxCoolerHeightMm:185, psuFormFactor:'ATX', radiatorMm:360, bays35:6, bays25:2, fanMounts:9, fansIncluded:3 } },
  { seedId:'case-lancool-216',   brand:'Lian Li', name:'Lancool 216', verify:true,
    specs:{ maxBoardFormFactor:'ATX', maxGpuLengthMm:392, maxCoolerHeightMm:180, psuFormFactor:'ATX', radiatorMm:360, bays35:2, bays25:2, fanMounts:7, fansIncluded:3 } },
  { seedId:'case-o11-evo',       brand:'Lian Li', name:'O11 Dynamic EVO', verify:true,
    specs:{ maxBoardFormFactor:'E-ATX', maxGpuLengthMm:420, maxCoolerHeightMm:167, psuFormFactor:'ATX', radiatorMm:360, bays35:2, bays25:4, fanMounts:10, fansIncluded:0 } },
  { seedId:'case-h5-flow',       brand:'NZXT', name:'H5 Flow', verify:true,
    specs:{ maxBoardFormFactor:'ATX', maxGpuLengthMm:365, maxCoolerHeightMm:165, psuFormFactor:'ATX', radiatorMm:280, bays35:1, bays25:2, fanMounts:7, fansIncluded:2 } },
  { seedId:'case-h7-flow',       brand:'NZXT', name:'H7 Flow', verify:true,
    specs:{ maxBoardFormFactor:'ATX', maxGpuLengthMm:400, maxCoolerHeightMm:185, psuFormFactor:'ATX', radiatorMm:360, bays35:2, bays25:4, fanMounts:7, fansIncluded:2 } },
  { seedId:'case-nr200p',        brand:'Cooler Master', name:'NR200P', verify:true,
    specs:{ maxBoardFormFactor:'Mini-ITX', maxGpuLengthMm:330, maxCoolerHeightMm:155, psuFormFactor:'SFX', radiatorMm:280, bays35:0, bays25:3, fanMounts:6, fansIncluded:2 } },
  { seedId:'case-p400a',         brand:'Phanteks', name:'Eclipse P400A', verify:true,
    specs:{ maxBoardFormFactor:'ATX', maxGpuLengthMm:420, maxCoolerHeightMm:160, psuFormFactor:'ATX', radiatorMm:360, bays35:2, bays25:2, fanMounts:7, fansIncluded:3 } },
];

// CPU coolers. Socket lists cover the mounting kits current retail revisions
// ship with; an older boxed unit may predate the AM5 or LGA1851 bracket, so
// these carry the same verify flag as cases.
const ALL_MODERN_SOCKETS = ['AM5', 'AM4', 'LGA1851', 'LGA1700'];
const COOLERS = [
  { seedId:'cool-stock',        brand:'Generic', name:'Stock boxed cooler', verify:true,
    specs:{ coolerType:'Air', sockets:['AM5','AM4','LGA1700'], heightMm:70, tdpRating:65 } },
  { seedId:'cool-ak400',        brand:'DeepCool', name:'AK400', verify:true,
    specs:{ coolerType:'Air', sockets:ALL_MODERN_SOCKETS, heightMm:155, tdpRating:150 } },
  { seedId:'cool-ak620',        brand:'DeepCool', name:'AK620', verify:true,
    specs:{ coolerType:'Air', sockets:ALL_MODERN_SOCKETS, heightMm:160, tdpRating:260 } },
  { seedId:'cool-pa120',        brand:'Thermalright', name:'Peerless Assassin 120 SE', verify:true,
    specs:{ coolerType:'Air', sockets:ALL_MODERN_SOCKETS, heightMm:155, tdpRating:245 } },
  { seedId:'cool-hyper212',     brand:'Cooler Master', name:'Hyper 212 Black Edition', verify:true,
    specs:{ coolerType:'Air', sockets:ALL_MODERN_SOCKETS, heightMm:159, tdpRating:150 } },
  { seedId:'cool-nh-u12s',      brand:'Noctua', name:'NH-U12S redux', verify:true,
    specs:{ coolerType:'Air', sockets:ALL_MODERN_SOCKETS, heightMm:158, tdpRating:160 } },
  { seedId:'cool-nh-d15',       brand:'Noctua', name:'NH-D15', verify:true,
    specs:{ coolerType:'Air', sockets:ALL_MODERN_SOCKETS, heightMm:165, tdpRating:250 } },
  { seedId:'cool-nh-l9i',       brand:'Noctua', name:'NH-L9i (low profile)', verify:true,
    specs:{ coolerType:'Air', sockets:['LGA1700','LGA1851'], heightMm:37, tdpRating:65 } },
  { seedId:'cool-aio-240',      brand:'Generic', name:'240mm AIO liquid cooler', verify:true,
    specs:{ coolerType:'Liquid (AIO)', sockets:ALL_MODERN_SOCKETS, radiatorMm:240, tdpRating:200 } },
  { seedId:'cool-aio-280',      brand:'Generic', name:'280mm AIO liquid cooler', verify:true,
    specs:{ coolerType:'Liquid (AIO)', sockets:ALL_MODERN_SOCKETS, radiatorMm:280, tdpRating:250 } },
  { seedId:'cool-aio-360',      brand:'Generic', name:'360mm AIO liquid cooler', verify:true,
    specs:{ coolerType:'Liquid (AIO)', sockets:ALL_MODERN_SOCKETS, radiatorMm:360, tdpRating:300 } },
];

const FANS = [
  { seedId:'fan-120',    brand:'Generic', name:'120mm case fan',      specs:{ sizeMm:120, watts:2 } },
  { seedId:'fan-140',    brand:'Generic', name:'140mm case fan',      specs:{ sizeMm:140, watts:3 } },
  { seedId:'fan-120-pwm',brand:'Generic', name:'120mm PWM case fan',  specs:{ sizeMm:120, watts:2 } },
];

const OS = [
  { seedId:'os-win11-home', brand:'Microsoft', name:'Windows 11 Home (OEM)', specs:{} },
  { seedId:'os-win11-pro',  brand:'Microsoft', name:'Windows 11 Pro (OEM)',  specs:{} },
  { seedId:'os-linux',      brand:'Generic',   name:'Linux (no licence cost)', specs:{} },
];

// Flattened, each entry stamped with its category.
const withCategory = (category, items) => items.map(i => ({ ...i, category }));

export const PC_PARTS_SEED = [
  ...withCategory('cpu', CPUS),
  ...withCategory('motherboard', MOTHERBOARDS),
  ...withCategory('gpu', GPUS),
  ...withCategory('ram', RAM),
  ...withCategory('storage', STORAGE),
  ...withCategory('psu', PSUS),
  ...withCategory('case', CASES),
  ...withCategory('cooler', COOLERS),
  ...withCategory('fan', FANS),
  ...withCategory('os', OS),
];

export default PC_PARTS_SEED;
