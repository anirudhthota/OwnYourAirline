export const REGIONS = {
    ASIA: 'Asia',
    EUROPE: 'Europe',
    MIDDLE_EAST: 'Middle East',
    AFRICA: 'Africa',
    NORTH_AMERICA: 'North America',
    SOUTH_AMERICA: 'South America',
    PACIFIC: 'Pacific'
};

export const AIRPORTS = [
    // ===== ASIA =====
    { iata: 'PEK', name: 'Beijing Capital International Airport', city: 'Beijing', country: 'China', lat: 40.0799, lon: 116.6031, slotsPerHour: 80, region: REGIONS.ASIA },
    { iata: 'PKX', name: 'Beijing Daxing International Airport', city: 'Beijing', country: 'China', lat: 39.5098, lon: 116.4105, slotsPerHour: 70, region: REGIONS.ASIA },
    { iata: 'PVG', name: 'Shanghai Pudong International Airport', city: 'Shanghai', country: 'China', lat: 31.1443, lon: 121.8083, slotsPerHour: 76, region: REGIONS.ASIA },
    { iata: 'SHA', name: 'Shanghai Hongqiao International Airport', city: 'Shanghai', country: 'China', lat: 31.1979, lon: 121.3363, slotsPerHour: 50, region: REGIONS.ASIA },
    { iata: 'CAN', name: 'Guangzhou Baiyun International Airport', city: 'Guangzhou', country: 'China', lat: 23.3924, lon: 113.2988, slotsPerHour: 68, region: REGIONS.ASIA },
    { iata: 'SZX', name: 'Shenzhen Bao\'an International Airport', city: 'Shenzhen', country: 'China', lat: 22.6393, lon: 113.8107, slotsPerHour: 52, region: REGIONS.ASIA },
    { iata: 'CTU', name: 'Chengdu Tianfu International Airport', city: 'Chengdu', country: 'China', lat: 30.3197, lon: 104.4412, slotsPerHour: 55, region: REGIONS.ASIA },
    { iata: 'KMG', name: 'Kunming Changshui International Airport', city: 'Kunming', country: 'China', lat: 25.1019, lon: 102.9292, slotsPerHour: 42, region: REGIONS.ASIA },
    { iata: 'XIY', name: 'Xi\'an Xianyang International Airport', city: 'Xi\'an', country: 'China', lat: 34.4371, lon: 108.7516, slotsPerHour: 40, region: REGIONS.ASIA },
    { iata: 'HGH', name: 'Hangzhou Xiaoshan International Airport', city: 'Hangzhou', country: 'China', lat: 30.2295, lon: 120.4344, slotsPerHour: 42, region: REGIONS.ASIA },
    { iata: 'CKG', name: 'Chongqing Jiangbei International Airport', city: 'Chongqing', country: 'China', lat: 29.7192, lon: 106.6417, slotsPerHour: 45, region: REGIONS.ASIA },
    { iata: 'WUH', name: 'Wuhan Tianhe International Airport', city: 'Wuhan', country: 'China', lat: 30.7838, lon: 114.2081, slotsPerHour: 38, region: REGIONS.ASIA },
    { iata: 'NKG', name: 'Nanjing Lukou International Airport', city: 'Nanjing', country: 'China', lat: 31.7420, lon: 118.8620, slotsPerHour: 36, region: REGIONS.ASIA },
    { iata: 'HKG', name: 'Hong Kong International Airport', city: 'Hong Kong', country: 'Hong Kong', lat: 22.3080, lon: 113.9185, slotsPerHour: 68, region: REGIONS.ASIA },
    { iata: 'TPE', name: 'Taiwan Taoyuan International Airport', city: 'Taipei', country: 'Taiwan', lat: 25.0777, lon: 121.2325, slotsPerHour: 50, region: REGIONS.ASIA },
    { iata: 'NRT', name: 'Narita International Airport', city: 'Tokyo', country: 'Japan', lat: 35.7647, lon: 140.3864, slotsPerHour: 60, region: REGIONS.ASIA },
    { iata: 'HND', name: 'Tokyo Haneda Airport', city: 'Tokyo', country: 'Japan', lat: 35.5494, lon: 139.7798, slotsPerHour: 80, region: REGIONS.ASIA },
    { iata: 'KIX', name: 'Kansai International Airport', city: 'Osaka', country: 'Japan', lat: 34.4347, lon: 135.2440, slotsPerHour: 45, region: REGIONS.ASIA },
    { iata: 'ITM', name: 'Osaka Itami Airport', city: 'Osaka', country: 'Japan', lat: 34.7855, lon: 135.4380, slotsPerHour: 32, region: REGIONS.ASIA },
    { iata: 'NGO', name: 'Chubu Centrair International Airport', city: 'Nagoya', country: 'Japan', lat: 34.8584, lon: 136.8124, slotsPerHour: 30, region: REGIONS.ASIA },
    { iata: 'FUK', name: 'Fukuoka Airport', city: 'Fukuoka', country: 'Japan', lat: 33.5859, lon: 130.4510, slotsPerHour: 28, region: REGIONS.ASIA },
    { iata: 'CTS', name: 'New Chitose Airport', city: 'Sapporo', country: 'Japan', lat: 42.7752, lon: 141.6924, slotsPerHour: 30, region: REGIONS.ASIA },
    { iata: 'ICN', name: 'Incheon International Airport', city: 'Seoul', country: 'South Korea', lat: 37.4602, lon: 126.4407, slotsPerHour: 72, region: REGIONS.ASIA },
    { iata: 'GMP', name: 'Gimpo International Airport', city: 'Seoul', country: 'South Korea', lat: 37.5586, lon: 126.7906, slotsPerHour: 35, region: REGIONS.ASIA },
    { iata: 'PUS', name: 'Gimhae International Airport', city: 'Busan', country: 'South Korea', lat: 35.1796, lon: 128.9382, slotsPerHour: 28, region: REGIONS.ASIA },
    { iata: 'CJU', name: 'Jeju International Airport', city: 'Jeju', country: 'South Korea', lat: 33.5113, lon: 126.4929, slotsPerHour: 30, region: REGIONS.ASIA },
    { iata: 'SIN', name: 'Singapore Changi Airport', city: 'Singapore', country: 'Singapore', lat: 1.3502, lon: 103.9944, slotsPerHour: 82, region: REGIONS.ASIA },
    { iata: 'KUL', name: 'Kuala Lumpur International Airport', city: 'Kuala Lumpur', country: 'Malaysia', lat: 2.7456, lon: 101.7099, slotsPerHour: 60, region: REGIONS.ASIA },
    { iata: 'PEN', name: 'Penang International Airport', city: 'Penang', country: 'Malaysia', lat: 5.2972, lon: 100.2768, slotsPerHour: 20, region: REGIONS.ASIA },
    { iata: 'BKK', name: 'Suvarnabhumi Airport', city: 'Bangkok', country: 'Thailand', lat: 13.6900, lon: 100.7501, slotsPerHour: 68, region: REGIONS.ASIA },
    { iata: 'DMK', name: 'Don Mueang International Airport', city: 'Bangkok', country: 'Thailand', lat: 13.9126, lon: 100.6068, slotsPerHour: 40, region: REGIONS.ASIA },
    { iata: 'CNX', name: 'Chiang Mai International Airport', city: 'Chiang Mai', country: 'Thailand', lat: 18.7668, lon: 98.9626, slotsPerHour: 18, region: REGIONS.ASIA },
    { iata: 'HKT', name: 'Phuket International Airport', city: 'Phuket', country: 'Thailand', lat: 8.1132, lon: 98.3169, slotsPerHour: 22, region: REGIONS.ASIA },
    { iata: 'CGK', name: 'Soekarno-Hatta International Airport', city: 'Jakarta', country: 'Indonesia', lat: -6.1256, lon: 106.6559, slotsPerHour: 65, region: REGIONS.ASIA },
    { iata: 'DPS', name: 'Ngurah Rai International Airport', city: 'Bali', country: 'Indonesia', lat: -8.7482, lon: 115.1672, slotsPerHour: 30, region: REGIONS.ASIA },
    { iata: 'SUB', name: 'Juanda International Airport', city: 'Surabaya', country: 'Indonesia', lat: -7.3798, lon: 112.7870, slotsPerHour: 25, region: REGIONS.ASIA },
    { iata: 'MNL', name: 'Ninoy Aquino International Airport', city: 'Manila', country: 'Philippines', lat: 14.5086, lon: 121.0198, slotsPerHour: 40, region: REGIONS.ASIA },
    { iata: 'CEB', name: 'Mactan-Cebu International Airport', city: 'Cebu', country: 'Philippines', lat: 10.3075, lon: 123.9794, slotsPerHour: 22, region: REGIONS.ASIA },
    { iata: 'SGN', name: 'Tan Son Nhat International Airport', city: 'Ho Chi Minh City', country: 'Vietnam', lat: 10.8188, lon: 106.6519, slotsPerHour: 38, region: REGIONS.ASIA },
    { iata: 'HAN', name: 'Noi Bai International Airport', city: 'Hanoi', country: 'Vietnam', lat: 21.2212, lon: 105.8070, slotsPerHour: 35, region: REGIONS.ASIA },
    { iata: 'DAD', name: 'Da Nang International Airport', city: 'Da Nang', country: 'Vietnam', lat: 16.0439, lon: 108.1992, slotsPerHour: 18, region: REGIONS.ASIA },
    { iata: 'RGN', name: 'Yangon International Airport', city: 'Yangon', country: 'Myanmar', lat: 16.9073, lon: 96.1332, slotsPerHour: 18, region: REGIONS.ASIA },
    { iata: 'PNH', name: 'Phnom Penh International Airport', city: 'Phnom Penh', country: 'Cambodia', lat: 11.5466, lon: 104.8441, slotsPerHour: 14, region: REGIONS.ASIA },
    { iata: 'REP', name: 'Siem Reap International Airport', city: 'Siem Reap', country: 'Cambodia', lat: 13.4107, lon: 103.8132, slotsPerHour: 10, region: REGIONS.ASIA },
    { iata: 'DEL', name: 'Indira Gandhi International Airport', city: 'New Delhi', country: 'India', lat: 28.5562, lon: 77.1000, slotsPerHour: 72, region: REGIONS.ASIA },
    { iata: 'BOM', name: 'Chhatrapati Shivaji Maharaj International Airport', city: 'Mumbai', country: 'India', lat: 19.0896, lon: 72.8656, slotsPerHour: 48, region: REGIONS.ASIA },
    { iata: 'BLR', name: 'Kempegowda International Airport', city: 'Bengaluru', country: 'India', lat: 13.1986, lon: 77.7066, slotsPerHour: 42, region: REGIONS.ASIA },
    { iata: 'MAA', name: 'Chennai International Airport', city: 'Chennai', country: 'India', lat: 12.9941, lon: 80.1709, slotsPerHour: 35, region: REGIONS.ASIA },
    { iata: 'HYD', name: 'Rajiv Gandhi International Airport', city: 'Hyderabad', country: 'India', lat: 17.2403, lon: 78.4294, slotsPerHour: 36, region: REGIONS.ASIA },
    { iata: 'CCU', name: 'Netaji Subhas Chandra Bose International Airport', city: 'Kolkata', country: 'India', lat: 22.6547, lon: 88.4467, slotsPerHour: 30, region: REGIONS.ASIA },
    { iata: 'COK', name: 'Cochin International Airport', city: 'Kochi', country: 'India', lat: 10.1520, lon: 76.4019, slotsPerHour: 20, region: REGIONS.ASIA },
    { iata: 'GOI', name: 'Goa International Airport', city: 'Goa', country: 'India', lat: 15.3808, lon: 73.8314, slotsPerHour: 16, region: REGIONS.ASIA },
    { iata: 'AMD', name: 'Sardar Vallabhbhai Patel International Airport', city: 'Ahmedabad', country: 'India', lat: 23.0772, lon: 72.6347, slotsPerHour: 22, region: REGIONS.ASIA },
    { iata: 'CMB', name: 'Bandaranaike International Airport', city: 'Colombo', country: 'Sri Lanka', lat: 7.1808, lon: 79.8841, slotsPerHour: 20, region: REGIONS.ASIA },
    { iata: 'DAC', name: 'Hazrat Shahjalal International Airport', city: 'Dhaka', country: 'Bangladesh', lat: 23.8432, lon: 90.3977, slotsPerHour: 22, region: REGIONS.ASIA },
    { iata: 'KTM', name: 'Tribhuvan International Airport', city: 'Kathmandu', country: 'Nepal', lat: 27.6966, lon: 85.3591, slotsPerHour: 12, region: REGIONS.ASIA },
    { iata: 'ISB', name: 'Islamabad International Airport', city: 'Islamabad', country: 'Pakistan', lat: 33.5605, lon: 72.8526, slotsPerHour: 20, region: REGIONS.ASIA },
    { iata: 'KHI', name: 'Jinnah International Airport', city: 'Karachi', country: 'Pakistan', lat: 24.9065, lon: 67.1609, slotsPerHour: 22, region: REGIONS.ASIA },
    { iata: 'LHE', name: 'Allama Iqbal International Airport', city: 'Lahore', country: 'Pakistan', lat: 31.5216, lon: 74.4036, slotsPerHour: 16, region: REGIONS.ASIA },
    { iata: 'MLE', name: 'Velana International Airport', city: 'Male', country: 'Maldives', lat: 4.1918, lon: 73.5290, slotsPerHour: 14, region: REGIONS.ASIA },
    { iata: 'ULN', name: 'Chinggis Khaan International Airport', city: 'Ulaanbaatar', country: 'Mongolia', lat: 47.8431, lon: 106.7668, slotsPerHour: 10, region: REGIONS.ASIA },
    { iata: 'TAS', name: 'Tashkent International Airport', city: 'Tashkent', country: 'Uzbekistan', lat: 41.2578, lon: 69.2812, slotsPerHour: 14, region: REGIONS.ASIA },
    { iata: 'ALA', name: 'Almaty International Airport', city: 'Almaty', country: 'Kazakhstan', lat: 43.3521, lon: 77.0405, slotsPerHour: 16, region: REGIONS.ASIA },
    { iata: 'NQZ', name: 'Nursultan Nazarbayev International Airport', city: 'Astana', country: 'Kazakhstan', lat: 51.0222, lon: 71.4669, slotsPerHour: 12, region: REGIONS.ASIA },

    // ===== EUROPE =====
    { iata: 'LHR', name: 'Heathrow Airport', city: 'London', country: 'United Kingdom', lat: 51.4700, lon: -0.4543, slotsPerHour: 88, region: REGIONS.EUROPE },
    { iata: 'LGW', name: 'Gatwick Airport', city: 'London', country: 'United Kingdom', lat: 51.1537, lon: -0.1821, slotsPerHour: 55, region: REGIONS.EUROPE },
    { iata: 'STN', name: 'London Stansted Airport', city: 'London', country: 'United Kingdom', lat: 51.8860, lon: 0.2389, slotsPerHour: 40, region: REGIONS.EUROPE },
    { iata: 'LTN', name: 'London Luton Airport', city: 'London', country: 'United Kingdom', lat: 51.8747, lon: -0.3684, slotsPerHour: 30, region: REGIONS.EUROPE },
    { iata: 'MAN', name: 'Manchester Airport', city: 'Manchester', country: 'United Kingdom', lat: 53.3537, lon: -2.2750, slotsPerHour: 45, region: REGIONS.EUROPE },
    { iata: 'EDI', name: 'Edinburgh Airport', city: 'Edinburgh', country: 'United Kingdom', lat: 55.9500, lon: -3.3725, slotsPerHour: 28, region: REGIONS.EUROPE },
    { iata: 'BHX', name: 'Birmingham Airport', city: 'Birmingham', country: 'United Kingdom', lat: 52.4539, lon: -1.7480, slotsPerHour: 24, region: REGIONS.EUROPE },
    { iata: 'CDG', name: 'Charles de Gaulle Airport', city: 'Paris', country: 'France', lat: 49.0097, lon: 2.5479, slotsPerHour: 86, region: REGIONS.EUROPE },
    { iata: 'ORY', name: 'Orly Airport', city: 'Paris', country: 'France', lat: 48.7233, lon: 2.3794, slotsPerHour: 42, region: REGIONS.EUROPE },
    { iata: 'NCE', name: 'Nice Côte d\'Azur Airport', city: 'Nice', country: 'France', lat: 43.6584, lon: 7.2159, slotsPerHour: 28, region: REGIONS.EUROPE },
    { iata: 'LYS', name: 'Lyon-Saint Exupéry Airport', city: 'Lyon', country: 'France', lat: 45.7256, lon: 5.0811, slotsPerHour: 22, region: REGIONS.EUROPE },
    { iata: 'MRS', name: 'Marseille Provence Airport', city: 'Marseille', country: 'France', lat: 43.4393, lon: 5.2214, slotsPerHour: 20, region: REGIONS.EUROPE },
    { iata: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany', lat: 50.0379, lon: 8.5622, slotsPerHour: 90, region: REGIONS.EUROPE },
    { iata: 'MUC', name: 'Munich Airport', city: 'Munich', country: 'Germany', lat: 48.3538, lon: 11.7861, slotsPerHour: 70, region: REGIONS.EUROPE },
    { iata: 'DUS', name: 'Düsseldorf Airport', city: 'Düsseldorf', country: 'Germany', lat: 51.2895, lon: 6.7668, slotsPerHour: 40, region: REGIONS.EUROPE },
    { iata: 'TXL', name: 'Berlin Brandenburg Airport', city: 'Berlin', country: 'Germany', lat: 52.3667, lon: 13.5033, slotsPerHour: 45, region: REGIONS.EUROPE },
    { iata: 'HAM', name: 'Hamburg Airport', city: 'Hamburg', country: 'Germany', lat: 53.6304, lon: 9.9882, slotsPerHour: 30, region: REGIONS.EUROPE },
    { iata: 'CGN', name: 'Cologne Bonn Airport', city: 'Cologne', country: 'Germany', lat: 50.8659, lon: 7.1427, slotsPerHour: 28, region: REGIONS.EUROPE },
    { iata: 'STR', name: 'Stuttgart Airport', city: 'Stuttgart', country: 'Germany', lat: 48.6899, lon: 9.2220, slotsPerHour: 22, region: REGIONS.EUROPE },
    { iata: 'AMS', name: 'Amsterdam Airport Schiphol', city: 'Amsterdam', country: 'Netherlands', lat: 52.3086, lon: 4.7639, slotsPerHour: 80, region: REGIONS.EUROPE },
    { iata: 'BRU', name: 'Brussels Airport', city: 'Brussels', country: 'Belgium', lat: 50.9014, lon: 4.4844, slotsPerHour: 40, region: REGIONS.EUROPE },
    { iata: 'MAD', name: 'Adolfo Suárez Madrid-Barajas Airport', city: 'Madrid', country: 'Spain', lat: 40.4983, lon: -3.5676, slotsPerHour: 72, region: REGIONS.EUROPE },
    { iata: 'BCN', name: 'Josep Tarradellas Barcelona-El Prat Airport', city: 'Barcelona', country: 'Spain', lat: 41.2971, lon: 2.0785, slotsPerHour: 58, region: REGIONS.EUROPE },
    { iata: 'PMI', name: 'Palma de Mallorca Airport', city: 'Palma de Mallorca', country: 'Spain', lat: 39.5517, lon: 2.7388, slotsPerHour: 40, region: REGIONS.EUROPE },
    { iata: 'AGP', name: 'Málaga Airport', city: 'Málaga', country: 'Spain', lat: 36.6749, lon: -4.4991, slotsPerHour: 30, region: REGIONS.EUROPE },
    { iata: 'ALC', name: 'Alicante-Elche Airport', city: 'Alicante', country: 'Spain', lat: 38.2822, lon: -0.5582, slotsPerHour: 24, region: REGIONS.EUROPE },
    { iata: 'FCO', name: 'Leonardo da Vinci-Fiumicino Airport', city: 'Rome', country: 'Italy', lat: 41.8003, lon: 12.2389, slotsPerHour: 65, region: REGIONS.EUROPE },
    { iata: 'MXP', name: 'Milan Malpensa Airport', city: 'Milan', country: 'Italy', lat: 45.6306, lon: 8.7281, slotsPerHour: 50, region: REGIONS.EUROPE },
    { iata: 'LIN', name: 'Milan Linate Airport', city: 'Milan', country: 'Italy', lat: 45.4497, lon: 9.2783, slotsPerHour: 20, region: REGIONS.EUROPE },
    { iata: 'NAP', name: 'Naples International Airport', city: 'Naples', country: 'Italy', lat: 40.8860, lon: 14.2908, slotsPerHour: 22, region: REGIONS.EUROPE },
    { iata: 'VCE', name: 'Venice Marco Polo Airport', city: 'Venice', country: 'Italy', lat: 45.5053, lon: 12.3519, slotsPerHour: 22, region: REGIONS.EUROPE },
    { iata: 'LIS', name: 'Lisbon Humberto Delgado Airport', city: 'Lisbon', country: 'Portugal', lat: 38.7742, lon: -9.1342, slotsPerHour: 40, region: REGIONS.EUROPE },
    { iata: 'OPO', name: 'Francisco Sá Carneiro Airport', city: 'Porto', country: 'Portugal', lat: 41.2481, lon: -8.6814, slotsPerHour: 24, region: REGIONS.EUROPE },
    { iata: 'ZRH', name: 'Zurich Airport', city: 'Zurich', country: 'Switzerland', lat: 47.4647, lon: 8.5492, slotsPerHour: 55, region: REGIONS.EUROPE },
    { iata: 'GVA', name: 'Geneva Airport', city: 'Geneva', country: 'Switzerland', lat: 46.2381, lon: 6.1090, slotsPerHour: 28, region: REGIONS.EUROPE },
    { iata: 'VIE', name: 'Vienna International Airport', city: 'Vienna', country: 'Austria', lat: 48.1103, lon: 16.5697, slotsPerHour: 50, region: REGIONS.EUROPE },
    { iata: 'CPH', name: 'Copenhagen Airport', city: 'Copenhagen', country: 'Denmark', lat: 55.6180, lon: 12.6508, slotsPerHour: 50, region: REGIONS.EUROPE },
    { iata: 'OSL', name: 'Oslo Gardermoen Airport', city: 'Oslo', country: 'Norway', lat: 60.1939, lon: 11.1004, slotsPerHour: 40, region: REGIONS.EUROPE },
    { iata: 'ARN', name: 'Stockholm Arlanda Airport', city: 'Stockholm', country: 'Sweden', lat: 59.6519, lon: 17.9186, slotsPerHour: 42, region: REGIONS.EUROPE },
    { iata: 'HEL', name: 'Helsinki-Vantaa Airport', city: 'Helsinki', country: 'Finland', lat: 60.3172, lon: 24.9633, slotsPerHour: 35, region: REGIONS.EUROPE },
    { iata: 'DUB', name: 'Dublin Airport', city: 'Dublin', country: 'Ireland', lat: 53.4264, lon: -6.2499, slotsPerHour: 42, region: REGIONS.EUROPE },
    { iata: 'ATH', name: 'Athens International Airport', city: 'Athens', country: 'Greece', lat: 37.9364, lon: 23.9445, slotsPerHour: 38, region: REGIONS.EUROPE },
    { iata: 'IST', name: 'Istanbul Airport', city: 'Istanbul', country: 'Turkey', lat: 41.2608, lon: 28.7418, slotsPerHour: 80, region: REGIONS.EUROPE },
    { iata: 'SAW', name: 'Sabiha Gökçen International Airport', city: 'Istanbul', country: 'Turkey', lat: 40.8986, lon: 29.3092, slotsPerHour: 45, region: REGIONS.EUROPE },
    { iata: 'AYT', name: 'Antalya Airport', city: 'Antalya', country: 'Turkey', lat: 36.8987, lon: 30.8005, slotsPerHour: 35, region: REGIONS.EUROPE },
    { iata: 'ESB', name: 'Esenboğa International Airport', city: 'Ankara', country: 'Turkey', lat: 40.1281, lon: 32.9951, slotsPerHour: 22, region: REGIONS.EUROPE },
    { iata: 'WAW', name: 'Warsaw Chopin Airport', city: 'Warsaw', country: 'Poland', lat: 52.1657, lon: 20.9671, slotsPerHour: 35, region: REGIONS.EUROPE },
    { iata: 'KRK', name: 'John Paul II International Airport', city: 'Kraków', country: 'Poland', lat: 50.0777, lon: 19.7848, slotsPerHour: 18, region: REGIONS.EUROPE },
    { iata: 'PRG', name: 'Václav Havel Airport Prague', city: 'Prague', country: 'Czech Republic', lat: 50.1008, lon: 14.2600, slotsPerHour: 35, region: REGIONS.EUROPE },
    { iata: 'BUD', name: 'Budapest Ferenc Liszt International Airport', city: 'Budapest', country: 'Hungary', lat: 47.4369, lon: 19.2556, slotsPerHour: 30, region: REGIONS.EUROPE },
    { iata: 'OTP', name: 'Henri Coandă International Airport', city: 'Bucharest', country: 'Romania', lat: 44.5711, lon: 26.0850, slotsPerHour: 24, region: REGIONS.EUROPE },
    { iata: 'SOF', name: 'Sofia Airport', city: 'Sofia', country: 'Bulgaria', lat: 42.6967, lon: 23.4144, slotsPerHour: 18, region: REGIONS.EUROPE },
    { iata: 'BEG', name: 'Belgrade Nikola Tesla Airport', city: 'Belgrade', country: 'Serbia', lat: 44.8184, lon: 20.3091, slotsPerHour: 16, region: REGIONS.EUROPE },
    { iata: 'ZAG', name: 'Franjo Tuđman Airport', city: 'Zagreb', country: 'Croatia', lat: 45.7429, lon: 16.0688, slotsPerHour: 14, region: REGIONS.EUROPE },
    { iata: 'SVO', name: 'Sheremetyevo International Airport', city: 'Moscow', country: 'Russia', lat: 55.9726, lon: 37.4146, slotsPerHour: 70, region: REGIONS.EUROPE },
    { iata: 'DME', name: 'Domodedovo International Airport', city: 'Moscow', country: 'Russia', lat: 55.4088, lon: 37.9063, slotsPerHour: 55, region: REGIONS.EUROPE },
    { iata: 'LED', name: 'Pulkovo Airport', city: 'Saint Petersburg', country: 'Russia', lat: 59.8003, lon: 30.2625, slotsPerHour: 35, region: REGIONS.EUROPE },
    { iata: 'KEF', name: 'Keflavík International Airport', city: 'Reykjavík', country: 'Iceland', lat: 63.9850, lon: -22.6056, slotsPerHour: 18, region: REGIONS.EUROPE },
    { iata: 'RIX', name: 'Riga International Airport', city: 'Riga', country: 'Latvia', lat: 56.9236, lon: 23.9711, slotsPerHour: 18, region: REGIONS.EUROPE },
    { iata: 'TLL', name: 'Lennart Meri Tallinn Airport', city: 'Tallinn', country: 'Estonia', lat: 59.4133, lon: 24.8328, slotsPerHour: 14, region: REGIONS.EUROPE },
    { iata: 'VNO', name: 'Vilnius Airport', city: 'Vilnius', country: 'Lithuania', lat: 54.6341, lon: 25.2858, slotsPerHour: 14, region: REGIONS.EUROPE },
    { iata: 'LUX', name: 'Luxembourg Airport', city: 'Luxembourg', country: 'Luxembourg', lat: 49.6233, lon: 6.2044, slotsPerHour: 14, region: REGIONS.EUROPE },

    // ===== MIDDLE EAST =====
    { iata: 'DXB', name: 'Dubai International Airport', city: 'Dubai', country: 'UAE', lat: 25.2532, lon: 55.3657, slotsPerHour: 90, region: REGIONS.MIDDLE_EAST },
    { iata: 'DWC', name: 'Al Maktoum International Airport', city: 'Dubai', country: 'UAE', lat: 24.8960, lon: 55.1614, slotsPerHour: 40, region: REGIONS.MIDDLE_EAST },
    { iata: 'AUH', name: 'Abu Dhabi International Airport', city: 'Abu Dhabi', country: 'UAE', lat: 24.4330, lon: 54.6511, slotsPerHour: 50, region: REGIONS.MIDDLE_EAST },
    { iata: 'DOH', name: 'Hamad International Airport', city: 'Doha', country: 'Qatar', lat: 25.2731, lon: 51.6081, slotsPerHour: 60, region: REGIONS.MIDDLE_EAST },
    { iata: 'JED', name: 'King Abdulaziz International Airport', city: 'Jeddah', country: 'Saudi Arabia', lat: 21.6796, lon: 39.1565, slotsPerHour: 50, region: REGIONS.MIDDLE_EAST },
    { iata: 'RUH', name: 'King Khalid International Airport', city: 'Riyadh', country: 'Saudi Arabia', lat: 24.9578, lon: 46.6989, slotsPerHour: 45, region: REGIONS.MIDDLE_EAST },
    { iata: 'DMM', name: 'King Fahd International Airport', city: 'Dammam', country: 'Saudi Arabia', lat: 26.4712, lon: 49.7979, slotsPerHour: 25, region: REGIONS.MIDDLE_EAST },
    { iata: 'MED', name: 'Prince Mohammad bin Abdulaziz International Airport', city: 'Medina', country: 'Saudi Arabia', lat: 24.5534, lon: 39.7051, slotsPerHour: 20, region: REGIONS.MIDDLE_EAST },
    { iata: 'BAH', name: 'Bahrain International Airport', city: 'Manama', country: 'Bahrain', lat: 26.2708, lon: 50.6336, slotsPerHour: 25, region: REGIONS.MIDDLE_EAST },
    { iata: 'MCT', name: 'Muscat International Airport', city: 'Muscat', country: 'Oman', lat: 23.5933, lon: 58.2844, slotsPerHour: 25, region: REGIONS.MIDDLE_EAST },
    { iata: 'KWI', name: 'Kuwait International Airport', city: 'Kuwait City', country: 'Kuwait', lat: 29.2266, lon: 47.9689, slotsPerHour: 30, region: REGIONS.MIDDLE_EAST },
    { iata: 'AMM', name: 'Queen Alia International Airport', city: 'Amman', country: 'Jordan', lat: 31.7226, lon: 35.9932, slotsPerHour: 22, region: REGIONS.MIDDLE_EAST },
    { iata: 'BEY', name: 'Rafic Hariri International Airport', city: 'Beirut', country: 'Lebanon', lat: 33.8209, lon: 35.4884, slotsPerHour: 18, region: REGIONS.MIDDLE_EAST },
    { iata: 'TLV', name: 'Ben Gurion Airport', city: 'Tel Aviv', country: 'Israel', lat: 32.0114, lon: 34.8867, slotsPerHour: 35, region: REGIONS.MIDDLE_EAST },
    { iata: 'IKA', name: 'Imam Khomeini International Airport', city: 'Tehran', country: 'Iran', lat: 35.4161, lon: 51.1522, slotsPerHour: 30, region: REGIONS.MIDDLE_EAST },
    { iata: 'BGW', name: 'Baghdad International Airport', city: 'Baghdad', country: 'Iraq', lat: 33.2625, lon: 44.2346, slotsPerHour: 14, region: REGIONS.MIDDLE_EAST },
    { iata: 'EBL', name: 'Erbil International Airport', city: 'Erbil', country: 'Iraq', lat: 36.2376, lon: 43.9632, slotsPerHour: 10, region: REGIONS.MIDDLE_EAST },

    // ===== AFRICA =====
    { iata: 'JNB', name: 'O. R. Tambo International Airport', city: 'Johannesburg', country: 'South Africa', lat: -26.1367, lon: 28.2411, slotsPerHour: 45, region: REGIONS.AFRICA },
    { iata: 'CPT', name: 'Cape Town International Airport', city: 'Cape Town', country: 'South Africa', lat: -33.9715, lon: 18.6021, slotsPerHour: 30, region: REGIONS.AFRICA },
    { iata: 'DUR', name: 'King Shaka International Airport', city: 'Durban', country: 'South Africa', lat: -29.6144, lon: 31.1197, slotsPerHour: 18, region: REGIONS.AFRICA },
    { iata: 'CAI', name: 'Cairo International Airport', city: 'Cairo', country: 'Egypt', lat: 30.1219, lon: 31.4056, slotsPerHour: 45, region: REGIONS.AFRICA },
    { iata: 'HRG', name: 'Hurghada International Airport', city: 'Hurghada', country: 'Egypt', lat: 27.1786, lon: 33.7994, slotsPerHour: 18, region: REGIONS.AFRICA },
    { iata: 'SSH', name: 'Sharm el-Sheikh International Airport', city: 'Sharm el-Sheikh', country: 'Egypt', lat: 27.9773, lon: 34.3953, slotsPerHour: 14, region: REGIONS.AFRICA },
    { iata: 'CMN', name: 'Mohammed V International Airport', city: 'Casablanca', country: 'Morocco', lat: 33.3675, lon: -7.5900, slotsPerHour: 28, region: REGIONS.AFRICA },
    { iata: 'RAK', name: 'Marrakech Menara Airport', city: 'Marrakech', country: 'Morocco', lat: 31.6069, lon: -8.0363, slotsPerHour: 18, region: REGIONS.AFRICA },
    { iata: 'TUN', name: 'Tunis-Carthage International Airport', city: 'Tunis', country: 'Tunisia', lat: 36.8510, lon: 10.2272, slotsPerHour: 18, region: REGIONS.AFRICA },
    { iata: 'ALG', name: 'Houari Boumediene Airport', city: 'Algiers', country: 'Algeria', lat: 36.6910, lon: 3.2154, slotsPerHour: 20, region: REGIONS.AFRICA },
    { iata: 'NBO', name: 'Jomo Kenyatta International Airport', city: 'Nairobi', country: 'Kenya', lat: -1.3192, lon: 36.9278, slotsPerHour: 28, region: REGIONS.AFRICA },
    { iata: 'MBA', name: 'Moi International Airport', city: 'Mombasa', country: 'Kenya', lat: -4.0348, lon: 39.5942, slotsPerHour: 12, region: REGIONS.AFRICA },
    { iata: 'ADD', name: 'Addis Ababa Bole International Airport', city: 'Addis Ababa', country: 'Ethiopia', lat: 8.9779, lon: 38.7993, slotsPerHour: 35, region: REGIONS.AFRICA },
    { iata: 'LOS', name: 'Murtala Muhammed International Airport', city: 'Lagos', country: 'Nigeria', lat: 6.5774, lon: 3.3212, slotsPerHour: 30, region: REGIONS.AFRICA },
    { iata: 'ABV', name: 'Nnamdi Azikiwe International Airport', city: 'Abuja', country: 'Nigeria', lat: 9.0065, lon: 7.2632, slotsPerHour: 18, region: REGIONS.AFRICA },
    { iata: 'ACC', name: 'Kotoka International Airport', city: 'Accra', country: 'Ghana', lat: 5.6052, lon: -0.1668, slotsPerHour: 18, region: REGIONS.AFRICA },
    { iata: 'DSS', name: 'Blaise Diagne International Airport', city: 'Dakar', country: 'Senegal', lat: 14.6700, lon: -17.0733, slotsPerHour: 14, region: REGIONS.AFRICA },
    { iata: 'DAR', name: 'Julius Nyerere International Airport', city: 'Dar es Salaam', country: 'Tanzania', lat: -6.8781, lon: 39.2026, slotsPerHour: 16, region: REGIONS.AFRICA },
    { iata: 'EBB', name: 'Entebbe International Airport', city: 'Entebbe', country: 'Uganda', lat: 0.0424, lon: 32.4435, slotsPerHour: 12, region: REGIONS.AFRICA },
    { iata: 'KGL', name: 'Kigali International Airport', city: 'Kigali', country: 'Rwanda', lat: -1.9686, lon: 30.1395, slotsPerHour: 10, region: REGIONS.AFRICA },
    { iata: 'TNR', name: 'Ivato International Airport', city: 'Antananarivo', country: 'Madagascar', lat: -18.7969, lon: 47.4788, slotsPerHour: 10, region: REGIONS.AFRICA },
    { iata: 'MRU', name: 'Sir Seewoosagur Ramgoolam International Airport', city: 'Mauritius', country: 'Mauritius', lat: -20.4302, lon: 57.6836, slotsPerHour: 14, region: REGIONS.AFRICA },

    // ===== NORTH AMERICA =====
    { iata: 'ATL', name: 'Hartsfield-Jackson Atlanta International Airport', city: 'Atlanta', country: 'United States', lat: 33.6407, lon: -84.4277, slotsPerHour: 100, region: REGIONS.NORTH_AMERICA },
    { iata: 'ORD', name: 'O\'Hare International Airport', city: 'Chicago', country: 'United States', lat: 41.9742, lon: -87.9073, slotsPerHour: 90, region: REGIONS.NORTH_AMERICA },
    { iata: 'DFW', name: 'Dallas/Fort Worth International Airport', city: 'Dallas', country: 'United States', lat: 32.8998, lon: -97.0403, slotsPerHour: 88, region: REGIONS.NORTH_AMERICA },
    { iata: 'DEN', name: 'Denver International Airport', city: 'Denver', country: 'United States', lat: 39.8561, lon: -104.6737, slotsPerHour: 80, region: REGIONS.NORTH_AMERICA },
    { iata: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', country: 'United States', lat: 40.6413, lon: -73.7781, slotsPerHour: 75, region: REGIONS.NORTH_AMERICA },
    { iata: 'EWR', name: 'Newark Liberty International Airport', city: 'Newark', country: 'United States', lat: 40.6895, lon: -74.1745, slotsPerHour: 60, region: REGIONS.NORTH_AMERICA },
    { iata: 'LGA', name: 'LaGuardia Airport', city: 'New York', country: 'United States', lat: 40.7769, lon: -73.8740, slotsPerHour: 50, region: REGIONS.NORTH_AMERICA },
    { iata: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', country: 'United States', lat: 33.9425, lon: -118.4081, slotsPerHour: 85, region: REGIONS.NORTH_AMERICA },
    { iata: 'SFO', name: 'San Francisco International Airport', city: 'San Francisco', country: 'United States', lat: 37.6213, lon: -122.3790, slotsPerHour: 60, region: REGIONS.NORTH_AMERICA },
    { iata: 'SEA', name: 'Seattle-Tacoma International Airport', city: 'Seattle', country: 'United States', lat: 47.4502, lon: -122.3088, slotsPerHour: 55, region: REGIONS.NORTH_AMERICA },
    { iata: 'MIA', name: 'Miami International Airport', city: 'Miami', country: 'United States', lat: 25.7959, lon: -80.2870, slotsPerHour: 65, region: REGIONS.NORTH_AMERICA },
    { iata: 'MCO', name: 'Orlando International Airport', city: 'Orlando', country: 'United States', lat: 28.4312, lon: -81.3081, slotsPerHour: 55, region: REGIONS.NORTH_AMERICA },
    { iata: 'CLT', name: 'Charlotte Douglas International Airport', city: 'Charlotte', country: 'United States', lat: 35.2141, lon: -80.9431, slotsPerHour: 60, region: REGIONS.NORTH_AMERICA },
    { iata: 'PHX', name: 'Phoenix Sky Harbor International Airport', city: 'Phoenix', country: 'United States', lat: 33.4373, lon: -112.0078, slotsPerHour: 50, region: REGIONS.NORTH_AMERICA },
    { iata: 'IAH', name: 'George Bush Intercontinental Airport', city: 'Houston', country: 'United States', lat: 29.9902, lon: -95.3368, slotsPerHour: 60, region: REGIONS.NORTH_AMERICA },
    { iata: 'MSP', name: 'Minneapolis-Saint Paul International Airport', city: 'Minneapolis', country: 'United States', lat: 44.8848, lon: -93.2223, slotsPerHour: 48, region: REGIONS.NORTH_AMERICA },
    { iata: 'DTW', name: 'Detroit Metropolitan Wayne County Airport', city: 'Detroit', country: 'United States', lat: 42.2124, lon: -83.3534, slotsPerHour: 48, region: REGIONS.NORTH_AMERICA },
    { iata: 'BOS', name: 'Boston Logan International Airport', city: 'Boston', country: 'United States', lat: 42.3656, lon: -71.0096, slotsPerHour: 48, region: REGIONS.NORTH_AMERICA },
    { iata: 'FLL', name: 'Fort Lauderdale-Hollywood International Airport', city: 'Fort Lauderdale', country: 'United States', lat: 26.0726, lon: -80.1527, slotsPerHour: 40, region: REGIONS.NORTH_AMERICA },
    { iata: 'PHL', name: 'Philadelphia International Airport', city: 'Philadelphia', country: 'United States', lat: 39.8721, lon: -75.2411, slotsPerHour: 48, region: REGIONS.NORTH_AMERICA },
    { iata: 'BWI', name: 'Baltimore-Washington International Airport', city: 'Baltimore', country: 'United States', lat: 39.1754, lon: -76.6683, slotsPerHour: 40, region: REGIONS.NORTH_AMERICA },
    { iata: 'IAD', name: 'Washington Dulles International Airport', city: 'Washington', country: 'United States', lat: 38.9531, lon: -77.4565, slotsPerHour: 45, region: REGIONS.NORTH_AMERICA },
    { iata: 'DCA', name: 'Ronald Reagan Washington National Airport', city: 'Washington', country: 'United States', lat: 38.8512, lon: -77.0402, slotsPerHour: 35, region: REGIONS.NORTH_AMERICA },
    { iata: 'SAN', name: 'San Diego International Airport', city: 'San Diego', country: 'United States', lat: 32.7336, lon: -117.1897, slotsPerHour: 30, region: REGIONS.NORTH_AMERICA },
    { iata: 'TPA', name: 'Tampa International Airport', city: 'Tampa', country: 'United States', lat: 27.9755, lon: -82.5332, slotsPerHour: 30, region: REGIONS.NORTH_AMERICA },
    { iata: 'SLC', name: 'Salt Lake City International Airport', city: 'Salt Lake City', country: 'United States', lat: 40.7884, lon: -111.9778, slotsPerHour: 42, region: REGIONS.NORTH_AMERICA },
    { iata: 'PDX', name: 'Portland International Airport', city: 'Portland', country: 'United States', lat: 45.5898, lon: -122.5951, slotsPerHour: 30, region: REGIONS.NORTH_AMERICA },
    { iata: 'LAS', name: 'Harry Reid International Airport', city: 'Las Vegas', country: 'United States', lat: 36.0840, lon: -115.1537, slotsPerHour: 50, region: REGIONS.NORTH_AMERICA },
    { iata: 'AUS', name: 'Austin-Bergstrom International Airport', city: 'Austin', country: 'United States', lat: 30.1975, lon: -97.6664, slotsPerHour: 30, region: REGIONS.NORTH_AMERICA },
    { iata: 'BNA', name: 'Nashville International Airport', city: 'Nashville', country: 'United States', lat: 36.1246, lon: -86.6782, slotsPerHour: 28, region: REGIONS.NORTH_AMERICA },
    { iata: 'RDU', name: 'Raleigh-Durham International Airport', city: 'Raleigh', country: 'United States', lat: 35.8776, lon: -78.7875, slotsPerHour: 24, region: REGIONS.NORTH_AMERICA },
    { iata: 'HNL', name: 'Daniel K. Inouye International Airport', city: 'Honolulu', country: 'United States', lat: 21.3245, lon: -157.9251, slotsPerHour: 35, region: REGIONS.NORTH_AMERICA },
    { iata: 'ANC', name: 'Ted Stevens Anchorage International Airport', city: 'Anchorage', country: 'United States', lat: 61.1743, lon: -149.9962, slotsPerHour: 20, region: REGIONS.NORTH_AMERICA },
    { iata: 'YYZ', name: 'Toronto Pearson International Airport', city: 'Toronto', country: 'Canada', lat: 43.6777, lon: -79.6248, slotsPerHour: 65, region: REGIONS.NORTH_AMERICA },
    { iata: 'YVR', name: 'Vancouver International Airport', city: 'Vancouver', country: 'Canada', lat: 49.1967, lon: -123.1815, slotsPerHour: 42, region: REGIONS.NORTH_AMERICA },
    { iata: 'YUL', name: 'Montréal-Pierre Elliott Trudeau International Airport', city: 'Montréal', country: 'Canada', lat: 45.4706, lon: -73.7408, slotsPerHour: 38, region: REGIONS.NORTH_AMERICA },
    { iata: 'YYC', name: 'Calgary International Airport', city: 'Calgary', country: 'Canada', lat: 51.1215, lon: -114.0076, slotsPerHour: 28, region: REGIONS.NORTH_AMERICA },
    { iata: 'YOW', name: 'Ottawa Macdonald-Cartier International Airport', city: 'Ottawa', country: 'Canada', lat: 45.3208, lon: -75.6692, slotsPerHour: 18, region: REGIONS.NORTH_AMERICA },
    { iata: 'YEG', name: 'Edmonton International Airport', city: 'Edmonton', country: 'Canada', lat: 53.3097, lon: -113.5800, slotsPerHour: 20, region: REGIONS.NORTH_AMERICA },
    { iata: 'MEX', name: 'Mexico City International Airport', city: 'Mexico City', country: 'Mexico', lat: 19.4363, lon: -99.0721, slotsPerHour: 55, region: REGIONS.NORTH_AMERICA },
    { iata: 'CUN', name: 'Cancún International Airport', city: 'Cancún', country: 'Mexico', lat: 21.0365, lon: -86.8771, slotsPerHour: 40, region: REGIONS.NORTH_AMERICA },
    { iata: 'GDL', name: 'Guadalajara International Airport', city: 'Guadalajara', country: 'Mexico', lat: 20.5218, lon: -103.3113, slotsPerHour: 25, region: REGIONS.NORTH_AMERICA },
    { iata: 'MTY', name: 'Monterrey International Airport', city: 'Monterrey', country: 'Mexico', lat: 25.7785, lon: -100.1069, slotsPerHour: 22, region: REGIONS.NORTH_AMERICA },
    { iata: 'SJO', name: 'Juan Santamaría International Airport', city: 'San José', country: 'Costa Rica', lat: 9.9939, lon: -84.2088, slotsPerHour: 16, region: REGIONS.NORTH_AMERICA },
    { iata: 'PTY', name: 'Tocumen International Airport', city: 'Panama City', country: 'Panama', lat: 9.0714, lon: -79.3835, slotsPerHour: 28, region: REGIONS.NORTH_AMERICA },
    { iata: 'SJU', name: 'Luis Muñoz Marín International Airport', city: 'San Juan', country: 'Puerto Rico', lat: 18.4394, lon: -66.0018, slotsPerHour: 22, region: REGIONS.NORTH_AMERICA },
    { iata: 'NAS', name: 'Lynden Pindling International Airport', city: 'Nassau', country: 'Bahamas', lat: 25.0390, lon: -77.4662, slotsPerHour: 14, region: REGIONS.NORTH_AMERICA },
    { iata: 'MBJ', name: 'Sangster International Airport', city: 'Montego Bay', country: 'Jamaica', lat: 18.5037, lon: -77.9134, slotsPerHour: 14, region: REGIONS.NORTH_AMERICA },
    { iata: 'HAV', name: 'José Martí International Airport', city: 'Havana', country: 'Cuba', lat: 22.9892, lon: -82.4091, slotsPerHour: 16, region: REGIONS.NORTH_AMERICA },
    { iata: 'SAL', name: 'Monseñor Óscar Arnulfo Romero International Airport', city: 'San Salvador', country: 'El Salvador', lat: 13.4409, lon: -89.0557, slotsPerHour: 14, region: REGIONS.NORTH_AMERICA },
    { iata: 'GUA', name: 'La Aurora International Airport', city: 'Guatemala City', country: 'Guatemala', lat: 14.5833, lon: -90.5275, slotsPerHour: 14, region: REGIONS.NORTH_AMERICA },

    // ===== SOUTH AMERICA =====
    { iata: 'GRU', name: 'São Paulo/Guarulhos International Airport', city: 'São Paulo', country: 'Brazil', lat: -23.4356, lon: -46.4731, slotsPerHour: 65, region: REGIONS.SOUTH_AMERICA },
    { iata: 'CGH', name: 'São Paulo/Congonhas Airport', city: 'São Paulo', country: 'Brazil', lat: -23.6261, lon: -46.6564, slotsPerHour: 30, region: REGIONS.SOUTH_AMERICA },
    { iata: 'GIG', name: 'Rio de Janeiro/Galeão International Airport', city: 'Rio de Janeiro', country: 'Brazil', lat: -22.8100, lon: -43.2505, slotsPerHour: 40, region: REGIONS.SOUTH_AMERICA },
    { iata: 'BSB', name: 'Brasília International Airport', city: 'Brasília', country: 'Brazil', lat: -15.8711, lon: -47.9186, slotsPerHour: 30, region: REGIONS.SOUTH_AMERICA },
    { iata: 'CNF', name: 'Belo Horizonte/Confins International Airport', city: 'Belo Horizonte', country: 'Brazil', lat: -19.6244, lon: -43.9719, slotsPerHour: 22, region: REGIONS.SOUTH_AMERICA },
    { iata: 'SSA', name: 'Salvador International Airport', city: 'Salvador', country: 'Brazil', lat: -12.9086, lon: -38.3225, slotsPerHour: 20, region: REGIONS.SOUTH_AMERICA },
    { iata: 'REC', name: 'Recife/Guararapes International Airport', city: 'Recife', country: 'Brazil', lat: -8.1264, lon: -34.9236, slotsPerHour: 18, region: REGIONS.SOUTH_AMERICA },
    { iata: 'FOR', name: 'Fortaleza International Airport', city: 'Fortaleza', country: 'Brazil', lat: -3.7763, lon: -38.5326, slotsPerHour: 18, region: REGIONS.SOUTH_AMERICA },
    { iata: 'POA', name: 'Porto Alegre International Airport', city: 'Porto Alegre', country: 'Brazil', lat: -29.9944, lon: -51.1714, slotsPerHour: 20, region: REGIONS.SOUTH_AMERICA },
    { iata: 'CWB', name: 'Curitiba International Airport', city: 'Curitiba', country: 'Brazil', lat: -25.5285, lon: -49.1758, slotsPerHour: 18, region: REGIONS.SOUTH_AMERICA },
    { iata: 'EZE', name: 'Ministro Pistarini International Airport', city: 'Buenos Aires', country: 'Argentina', lat: -34.8222, lon: -58.5358, slotsPerHour: 45, region: REGIONS.SOUTH_AMERICA },
    { iata: 'AEP', name: 'Jorge Newbery Airpark', city: 'Buenos Aires', country: 'Argentina', lat: -34.5592, lon: -58.4156, slotsPerHour: 25, region: REGIONS.SOUTH_AMERICA },
    { iata: 'COR', name: 'Ingeniero Ambrosio Taravella Airport', city: 'Córdoba', country: 'Argentina', lat: -31.3236, lon: -64.2081, slotsPerHour: 14, region: REGIONS.SOUTH_AMERICA },
    { iata: 'SCL', name: 'Arturo Merino Benítez International Airport', city: 'Santiago', country: 'Chile', lat: -33.3930, lon: -70.7858, slotsPerHour: 40, region: REGIONS.SOUTH_AMERICA },
    { iata: 'LIM', name: 'Jorge Chávez International Airport', city: 'Lima', country: 'Peru', lat: -12.0219, lon: -77.1143, slotsPerHour: 38, region: REGIONS.SOUTH_AMERICA },
    { iata: 'BOG', name: 'El Dorado International Airport', city: 'Bogotá', country: 'Colombia', lat: 4.7016, lon: -74.1469, slotsPerHour: 45, region: REGIONS.SOUTH_AMERICA },
    { iata: 'MDE', name: 'José María Córdova International Airport', city: 'Medellín', country: 'Colombia', lat: 6.1645, lon: -75.4231, slotsPerHour: 22, region: REGIONS.SOUTH_AMERICA },
    { iata: 'CTG', name: 'Rafael Núñez International Airport', city: 'Cartagena', country: 'Colombia', lat: 10.4424, lon: -75.5130, slotsPerHour: 16, region: REGIONS.SOUTH_AMERICA },
    { iata: 'UIO', name: 'Mariscal Sucre International Airport', city: 'Quito', country: 'Ecuador', lat: -0.1292, lon: -78.3575, slotsPerHour: 20, region: REGIONS.SOUTH_AMERICA },
    { iata: 'GYE', name: 'José Joaquín de Olmedo International Airport', city: 'Guayaquil', country: 'Ecuador', lat: -2.1574, lon: -79.8837, slotsPerHour: 16, region: REGIONS.SOUTH_AMERICA },
    { iata: 'CCS', name: 'Simón Bolívar International Airport', city: 'Caracas', country: 'Venezuela', lat: 10.6012, lon: -66.9913, slotsPerHour: 20, region: REGIONS.SOUTH_AMERICA },
    { iata: 'MVD', name: 'Carrasco International Airport', city: 'Montevideo', country: 'Uruguay', lat: -34.8384, lon: -56.0308, slotsPerHour: 16, region: REGIONS.SOUTH_AMERICA },
    { iata: 'ASU', name: 'Silvio Pettirossi International Airport', city: 'Asunción', country: 'Paraguay', lat: -25.2400, lon: -57.5190, slotsPerHour: 10, region: REGIONS.SOUTH_AMERICA },
    { iata: 'VVI', name: 'Viru Viru International Airport', city: 'Santa Cruz', country: 'Bolivia', lat: -17.6448, lon: -63.1354, slotsPerHour: 12, region: REGIONS.SOUTH_AMERICA },
    { iata: 'LPB', name: 'El Alto International Airport', city: 'La Paz', country: 'Bolivia', lat: -16.5133, lon: -68.1923, slotsPerHour: 10, region: REGIONS.SOUTH_AMERICA },

    // ===== PACIFIC =====
    { iata: 'SYD', name: 'Sydney Kingsford Smith Airport', city: 'Sydney', country: 'Australia', lat: -33.9461, lon: 151.1772, slotsPerHour: 65, region: REGIONS.PACIFIC },
    { iata: 'MEL', name: 'Melbourne Airport', city: 'Melbourne', country: 'Australia', lat: -37.6733, lon: 144.8433, slotsPerHour: 55, region: REGIONS.PACIFIC },
    { iata: 'BNE', name: 'Brisbane Airport', city: 'Brisbane', country: 'Australia', lat: -27.3842, lon: 153.1175, slotsPerHour: 40, region: REGIONS.PACIFIC },
    { iata: 'PER', name: 'Perth Airport', city: 'Perth', country: 'Australia', lat: -31.9403, lon: 115.9672, slotsPerHour: 32, region: REGIONS.PACIFIC },
    { iata: 'ADL', name: 'Adelaide Airport', city: 'Adelaide', country: 'Australia', lat: -34.9461, lon: 138.5311, slotsPerHour: 22, region: REGIONS.PACIFIC },
    { iata: 'OOL', name: 'Gold Coast Airport', city: 'Gold Coast', country: 'Australia', lat: -28.1644, lon: 153.5047, slotsPerHour: 16, region: REGIONS.PACIFIC },
    { iata: 'CNS', name: 'Cairns Airport', city: 'Cairns', country: 'Australia', lat: -16.8858, lon: 145.7553, slotsPerHour: 14, region: REGIONS.PACIFIC },
    { iata: 'AKL', name: 'Auckland Airport', city: 'Auckland', country: 'New Zealand', lat: -37.0082, lon: 174.7850, slotsPerHour: 38, region: REGIONS.PACIFIC },
    { iata: 'CHC', name: 'Christchurch Airport', city: 'Christchurch', country: 'New Zealand', lat: -43.4894, lon: 172.5322, slotsPerHour: 18, region: REGIONS.PACIFIC },
    { iata: 'WLG', name: 'Wellington Airport', city: 'Wellington', country: 'New Zealand', lat: -41.3272, lon: 174.8053, slotsPerHour: 16, region: REGIONS.PACIFIC },
    { iata: 'ZQN', name: 'Queenstown Airport', city: 'Queenstown', country: 'New Zealand', lat: -45.0211, lon: 168.7392, slotsPerHour: 10, region: REGIONS.PACIFIC },
    { iata: 'NAN', name: 'Nadi International Airport', city: 'Nadi', country: 'Fiji', lat: -17.7554, lon: 177.4431, slotsPerHour: 12, region: REGIONS.PACIFIC },
    { iata: 'PPT', name: 'Faa\'a International Airport', city: 'Papeete', country: 'French Polynesia', lat: -17.5537, lon: -149.6114, slotsPerHour: 8, region: REGIONS.PACIFIC },
    { iata: 'NOU', name: 'La Tontouta International Airport', city: 'Nouméa', country: 'New Caledonia', lat: -22.0146, lon: 166.2128, slotsPerHour: 8, region: REGIONS.PACIFIC },
    { iata: 'APW', name: 'Faleolo International Airport', city: 'Apia', country: 'Samoa', lat: -13.8297, lon: -172.0083, slotsPerHour: 6, region: REGIONS.PACIFIC },
    { iata: 'GUM', name: 'Antonio B. Won Pat International Airport', city: 'Hagåtña', country: 'Guam', lat: 13.4834, lon: 144.7959, slotsPerHour: 12, region: REGIONS.PACIFIC }
];

export function getAirportByIata(iata) {
    return AIRPORTS.find(a => a.iata === iata) || null;
}

export function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export function getDistanceBetweenAirports(iata1, iata2) {
    const a1 = getAirportByIata(iata1);
    const a2 = getAirportByIata(iata2);
    if (!a1 || !a2) return null;
    return haversineDistance(a1.lat, a1.lon, a2.lat, a2.lon);
}

export const SLOT_CONTROL_LEVELS = {
    1: { name: 'Uncontrolled', description: 'No slot limits enforced', costPerSlot: 0 },
    2: { name: 'Voluntary', description: 'Soft limits, rarely enforced', costPerSlot: 0 },
    3: { name: 'Coordinated', description: 'Limited slots, must hold a slot', costPerSlot: 50000 },
    4: { name: 'Fully Coordinated', description: 'Strict limits, slots are scarce', costPerSlot: 200000 },
    5: { name: 'Slot-Controlled', description: 'Extremely limited, very expensive', costPerSlot: 500000 }
};

const LEVEL_5_AIRPORTS = new Set(['LHR', 'JFK', 'NRT', 'CDG', 'HND']);
const LEVEL_4_AIRPORTS = new Set(['DXB', 'SIN', 'FRA', 'AMS', 'IST']);
const LEVEL_3_AIRPORTS = new Set([
    'DEL', 'BOM', 'DFW', 'LAX', 'ORD', 'ATL'
]);

export function getSlotControlLevel(iata) {
    if (LEVEL_5_AIRPORTS.has(iata)) return 5;
    if (LEVEL_4_AIRPORTS.has(iata)) return 4;
    if (LEVEL_3_AIRPORTS.has(iata)) return 3;
    const airport = getAirportByIata(iata);
    if (!airport) return 1;
    if (airport.slotsPerHour >= 60) return 2;
    return 1;
}

export function getSlotCost(iata) {
    const level = getSlotControlLevel(iata);
    return SLOT_CONTROL_LEVELS[level].costPerSlot;
}
