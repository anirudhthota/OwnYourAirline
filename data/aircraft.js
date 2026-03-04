export const AIRCRAFT_TYPES = [
    // Regional
    {
        type: 'ATR 72-600',
        manufacturer: 'ATR',
        category: 'Regional',
        seats: 72,
        rangeKm: 1528,
        cruiseSpeedKmh: 510,
        fuelBurnPerHour: 800,
        purchasePrice: 27000000,
        leaseCostPerMonth: 180000,
        maintenanceCostPerHour: 650,
        minRunwayLength: 1333
    },
    {
        type: 'Embraer E195-E2',
        manufacturer: 'Embraer',
        category: 'Regional',
        seats: 146,
        rangeKm: 4815,
        cruiseSpeedKmh: 870,
        fuelBurnPerHour: 2200,
        purchasePrice: 68000000,
        leaseCostPerMonth: 420000,
        maintenanceCostPerHour: 1100,
        minRunwayLength: 2100
    },

    // Narrow-body (Airbus)
    {
        type: 'A320neo',
        manufacturer: 'Airbus',
        category: 'Narrow-body',
        seats: 180,
        rangeKm: 6300,
        cruiseSpeedKmh: 833,
        fuelBurnPerHour: 2500,
        purchasePrice: 110700000,
        leaseCostPerMonth: 520000,
        maintenanceCostPerHour: 1400,
        minRunwayLength: 2100
    },
    {
        type: 'A321neo',
        manufacturer: 'Airbus',
        category: 'Narrow-body',
        seats: 220,
        rangeKm: 7400,
        cruiseSpeedKmh: 833,
        fuelBurnPerHour: 2700,
        purchasePrice: 133700000,
        leaseCostPerMonth: 610000,
        maintenanceCostPerHour: 1550,
        minRunwayLength: 2400
    },

    // Narrow-body (Boeing)
    {
        type: '737 MAX 8',
        manufacturer: 'Boeing',
        category: 'Narrow-body',
        seats: 178,
        rangeKm: 6570,
        cruiseSpeedKmh: 839,
        fuelBurnPerHour: 2530,
        purchasePrice: 121600000,
        leaseCostPerMonth: 540000,
        maintenanceCostPerHour: 1420,
        minRunwayLength: 2500
    },
    {
        type: '737 MAX 10',
        manufacturer: 'Boeing',
        category: 'Narrow-body',
        seats: 204,
        rangeKm: 6110,
        cruiseSpeedKmh: 839,
        fuelBurnPerHour: 2680,
        purchasePrice: 134900000,
        leaseCostPerMonth: 600000,
        maintenanceCostPerHour: 1500,
        minRunwayLength: 2700
    },

    // Wide-body (Airbus)
    {
        type: 'A330-900neo',
        manufacturer: 'Airbus',
        category: 'Wide-body',
        seats: 310,
        rangeKm: 13334,
        cruiseSpeedKmh: 871,
        fuelBurnPerHour: 5200,
        purchasePrice: 296400000,
        leaseCostPerMonth: 1200000,
        maintenanceCostPerHour: 2800,
        minRunwayLength: 2770
    },
    {
        type: 'A350-900',
        manufacturer: 'Airbus',
        category: 'Wide-body',
        seats: 325,
        rangeKm: 15000,
        cruiseSpeedKmh: 903,
        fuelBurnPerHour: 5800,
        purchasePrice: 317400000,
        leaseCostPerMonth: 1350000,
        maintenanceCostPerHour: 3100,
        minRunwayLength: 2600
    },
    {
        type: 'A350-1000',
        manufacturer: 'Airbus',
        category: 'Wide-body',
        seats: 366,
        rangeKm: 16100,
        cruiseSpeedKmh: 903,
        fuelBurnPerHour: 6300,
        purchasePrice: 366500000,
        leaseCostPerMonth: 1550000,
        maintenanceCostPerHour: 3400,
        minRunwayLength: 2900
    },
    {
        type: 'A380',
        manufacturer: 'Airbus',
        category: 'Super Heavy',
        seats: 555,
        rangeKm: 14800,
        cruiseSpeedKmh: 903,
        fuelBurnPerHour: 11200,
        purchasePrice: 445600000,
        leaseCostPerMonth: 2200000,
        maintenanceCostPerHour: 5500,
        minRunwayLength: 3000
    },

    // Wide-body (Boeing)
    {
        type: '787-8',
        manufacturer: 'Boeing',
        category: 'Wide-body',
        seats: 248,
        rangeKm: 13621,
        cruiseSpeedKmh: 903,
        fuelBurnPerHour: 5100,
        purchasePrice: 248300000,
        leaseCostPerMonth: 1050000,
        maintenanceCostPerHour: 2600,
        minRunwayLength: 2600
    },
    {
        type: '787-9',
        manufacturer: 'Boeing',
        category: 'Wide-body',
        seats: 296,
        rangeKm: 14140,
        cruiseSpeedKmh: 903,
        fuelBurnPerHour: 5500,
        purchasePrice: 292500000,
        leaseCostPerMonth: 1250000,
        maintenanceCostPerHour: 2900,
        minRunwayLength: 2800
    },
    {
        type: '777-300ER',
        manufacturer: 'Boeing',
        category: 'Wide-body',
        seats: 396,
        rangeKm: 13650,
        cruiseSpeedKmh: 892,
        fuelBurnPerHour: 7600,
        purchasePrice: 375500000,
        leaseCostPerMonth: 1650000,
        maintenanceCostPerHour: 3800,
        minRunwayLength: 3050
    },
    {
        type: '777X',
        manufacturer: 'Boeing',
        category: 'Wide-body',
        seats: 426,
        rangeKm: 16170,
        cruiseSpeedKmh: 905,
        fuelBurnPerHour: 7100,
        purchasePrice: 442200000,
        leaseCostPerMonth: 2000000,
        maintenanceCostPerHour: 4200,
        minRunwayLength: 3050
    }
];

export function getAircraftByType(type) {
    return AIRCRAFT_TYPES.find(a => a.type === type) || null;
}

export function getAircraftCategories() {
    return [...new Set(AIRCRAFT_TYPES.map(a => a.category))];
}

export function getAircraftByCategory(category) {
    return AIRCRAFT_TYPES.filter(a => a.category === category);
}

export const TURNAROUND_MINUTES = {
    'Regional': 25,
    'Narrow-body': 45,
    'Wide-body': 90,
    'Super Heavy': 120
};

export function getTurnaroundTime(aircraftType) {
    const ac = getAircraftByType(aircraftType);
    if (!ac) return 45;
    return TURNAROUND_MINUTES[ac.category] || 45;
}

export const FUEL_COST_PER_KG = 0.85;
export const CREW_COST_PER_FLIGHT_HOUR = 450;
export const AIRPORT_FEE_PER_DEPARTURE = 2500;
export const AIRPORT_FEE_PER_ARRIVAL = 2000;
export const DEPRECIATION_RATE_ANNUAL = 0.05;
export const LEASE_DEPOSIT_MONTHS = 3;
