// Mapeo distrito -> municipio-región (44) de Hacienda.
// Cada entrada: { dep: dep_code, muni: muni_code, codes: [distrito codes] }
// El muni_code es el code de cat_013_municipio para ese dep_code.
module.exports = [
  // ---------- 01 Ahuachapán ----------
  // Norte (13): Atiquizaya, El Refugio, San Lorenzo, Turín
  { dep: '01', muni: '13', codes: ['03','05','09','12'] },
  // Centro (14): Ahuachapán, Apaneca, Concepción de Ataco, Tacuba
  { dep: '01', muni: '14', codes: ['01','02','04','11'] },
  // Sur (15): Guaymango, Jujutla, San Francisco Menéndez, San Pedro Puxtla
  { dep: '01', muni: '15', codes: ['06','07','08','10'] },
  // ---------- 02 Santa Ana ----------
  // Norte (14): Masahuat, Metapán, Santa Rosa Guachipilín, Texistepeque
  { dep: '02', muni: '14', codes: ['06','07','11','13'] },
  // Centro (15): Santa Ana
  { dep: '02', muni: '15', codes: ['10'] },
  // Este (16): Coatepeque, El Congo
  { dep: '02', muni: '16', codes: ['02','04'] },
  // Oeste (17): Candelaria de la Frontera, Chalchuapa, El Porvenir, San Antonio Pajonal, San Sebastián Salitrillo, Santiago de la Frontera
  { dep: '02', muni: '17', codes: ['01','03','05','08','09','12'] },
  // ---------- 03 Sonsonate ----------
  // Norte (17): Juayúa, Nahuizalco, Salcoatitán, Santa Catarina Masahuat
  { dep: '03', muni: '17', codes: ['07','08','10','13'] },
  // Centro (18): Sonsonate, Sonzacate, Nahulingo, San Antonio del Monte, Santo Domingo de Guzmán
  { dep: '03', muni: '18', codes: ['15','16','09','11','14'] },
  // Este (19): Armenia, Caluco, Cuisnahuat, Izalco, San Julián, Santa Isabel Ishuatán
  { dep: '03', muni: '19', codes: ['02','03','04','06','12','05'] },
  // Oeste (20): Acajutla
  { dep: '03', muni: '20', codes: ['01'] },
  // ---------- 04 Chalatenango ----------
  // Norte (34): Citalá, La Palma, San Ignacio
  { dep: '04', muni: '34', codes: ['04','12','25'] },
  // Centro (35): Agua Caliente, Dulce Nombre de María, El Paraíso, La Reina, Nueva Concepción, San Fernando, San Francisco Morazán, San Rafael, Santa Rita, Tejutla
  { dep: '04', muni: '35', codes: ['01','08','10','13','16','22','24','31','32','33'] },
  // Sur (36): Arcatao, Azacualpa, Chalatenango, Comalapa, Concepción Quezaltepeque, El Carrizal, La Laguna, Las Vueltas, Nombre de Jesús, Nueva Trinidad, Ojos de Agua, Potonico, San Antonio de la Cruz, San Antonio Los Ranchos, San Francisco Lempa, San José Cancasque, San José Las Flores, San Isidro Labrador, San Luis del Carmen, San Miguel de Mercedes
  { dep: '04', muni: '36', codes: ['02','03','07','05','06','09','11','14','15','17','18','19','20','21','23','27','28','26','29','30'] },
  // ---------- 05 La Libertad ----------
  // Norte (23): Quezaltepeque, San Matías, San Pedro Tacachico
  { dep: '05', muni: '23', codes: ['12','16','17'] },
  // Centro (24): San Juan Opico, Ciudad Arce
  { dep: '05', muni: '24', codes: ['15','02'] },
  // Oeste (25): Colón, Jayaque, Sacacoyo, Tepecoyo, Talnique
  { dep: '05', muni: '25', codes: ['03','07','13','21','19'] },
  // Este (26): Antiguo Cuscatlán, Huizúcar, Nuevo Cuscatlán, San José Villanueva, Zaragoza
  { dep: '05', muni: '26', codes: ['01','06','10','14','22'] },
  // Costa (27): Chiltiupán, Jicalapa, La Libertad, Tamanique, Teotepeque
  { dep: '05', muni: '27', codes: ['05','08','09','18','20'] },
  // Sur (28): Santa Tecla, Comasagua
  { dep: '05', muni: '28', codes: ['11','04'] },
  // ---------- 06 San Salvador ----------
  // Norte (20): Aguilares, El Paisnal, Guazapa
  { dep: '06', muni: '20', codes: ['01','05','06'] },
  // Oeste (21): Apopa, Nejapa
  { dep: '06', muni: '21', codes: ['02','09'] },
  // Este (22): Ilopango, San Martín, Soyapango, Tonacatepeque
  { dep: '06', muni: '22', codes: ['07','13','17','18'] },
  // Centro (23): Ayutuxtepeque, Mejicanos, Cuscatancingo, Ciudad Delgado, San Salvador
  { dep: '06', muni: '23', codes: ['03','08','04','19','14'] },
  // Sur (24): San Marcos, Santo Tomás, Santiago Texacuangos, Panchimalco, Rosario de Mora
  { dep: '06', muni: '24', codes: ['12','16','15','10','11'] },
  // ---------- 07 Cuscatlán ----------
  // Norte (17): Suchitoto, San José Guayabal, Oratorio de Concepción, San Bartolomé Perulapía, San Pedro Perulapán
  { dep: '07', muni: '17', codes: ['15','09','06','07','10'] },
  // Sur (18): Cojutepeque, Candelaria, El Carmen, El Rosario, Monte San Juan, San Cristóbal, San Rafael Cedros, San Ramón, Santa Cruz Analquito, Santa Cruz Michapa, Tenancingo
  { dep: '07', muni: '18', codes: ['02','01','03','04','05','08','11','12','13','14','16'] },
  // ---------- 08 La Paz ----------
  // Oeste (23): Cuyultitán, Olocuilta, San Juan Talpa, San Luis Talpa, San Pedro Masahuat, Tapalhuaca, San Francisco Chinameca
  { dep: '08', muni: '23', codes: ['01','05','11','13','15','20','09'] },
  // Centro (24): El Rosario, Jerusalén, Mercedes La Ceiba, Paraíso de Osorio, San Antonio Masahuat, San Emigdio, San Juan Tepezontes, San Luis La Herradura, San Miguel Tepezontes, San Pedro Nonualco, Santa María Ostuma, Santiago Nonualco
  { dep: '08', muni: '24', codes: ['02','03','04','06','07','08','12','22','14','16','18','19'] },
  // Este (25): San Juan Nonualco, San Rafael Obrajuelo, Zacatecoluca
  { dep: '08', muni: '25', codes: ['10','17','21'] },
  // ---------- 09 Cabañas ----------
  // Oeste (10): Cinquera, Ilobasco, Jutiapa, Tejutepeque
  { dep: '09', muni: '10', codes: ['01','03','04','07'] },
  // Este (11): Guacotecti, San Isidro, Sensuntepeque, Victoria, Dolores
  { dep: '09', muni: '11', codes: ['02','05','06','08','09'] },
  // ---------- 10 San Vicente ----------
  // Norte (14): Apastepeque, Santa Clara, San Ildefonso, San Esteban Catarina, San Sebastián, San Lorenzo, Santo Domingo
  { dep: '10', muni: '14', codes: ['01','04','07','06','09','08','05'] },
  // Sur (15): San Vicente, Guadalupe, San Cayetano Istepeque, Tecoluca, Tepetitán, Verapaz
  { dep: '10', muni: '15', codes: ['10','02','03','11','12','13'] },
  // ---------- 11 Usulután ----------
  // Norte (24): Alegría, Berlín, El Triunfo, Estanzuelas, Jucuapa, Mercedes Umaña, Nueva Granada, San Buenaventura, Santiago de María
  { dep: '11', muni: '24', codes: ['01','02','05','07','09','11','12','16','21'] },
  // Este (25): California, Concepción Batres, Ereguayquín, Jucuarán, Ozatlán, Santa Elena, San Dionisio, Santa María, Tecapán, Usulután
  { dep: '11', muni: '25', codes: ['03','04','06','10','13','18','17','20','22','23'] },
  // Oeste (26): Jiquilisco, Puerto El Triunfo, San Agustín, San Francisco Javier
  { dep: '11', muni: '26', codes: ['08','14','15','19'] },
  // ---------- 12 San Miguel ----------
  // Norte (21): Ciudad Barrios, Sesori, Nuevo Edén de San Juan, San Gerardo, San Luis de la Reina, Carolina, San Antonio (del Mosco), Chapeltique
  { dep: '12', muni: '21', codes: ['02','19','11','14','16','01','13','04'] },
  // Centro (22): San Miguel, Comacarán, Uluazapa, Moncagua, Quelepa, Chirilagua
  { dep: '12', muni: '22', codes: ['17','03','20','09','12','06'] },
  // Oeste (23): Chinameca, El Tránsito, Lolotique, Nueva Guadalupe, San Jorge, San Rafael Oriente
  { dep: '12', muni: '23', codes: ['05','07','08','10','15','18'] },
  // ---------- 13 Morazán ----------
  // Norte (27): Arambala, Cacaopera, Corinto, El Rosario, Joateca, Jocoaitique, Meanguera, Perquín, San Fernando, San Isidro, Torola
  { dep: '13', muni: '27', codes: ['01','02','03','07','10','11','14','16','18','20','24'] },
  // Sur (28): Chilanga, Delicias de Concepción, El Divisadero, Gualococti, Guatajiagua, Jocoro, Lolotiquillo, Osicala, San Carlos, San Francisco Gotera, San Simón, Sensembra, Sociedad, Yamabal, Yoloaiquín
  { dep: '13', muni: '28', codes: ['04','05','06','08','09','12','13','15','17','19','21','22','23','25','26'] },
  // ---------- 14 La Unión ----------
  // Norte (19): Anamorós, Bolívar, Concepción de Oriente, El Sauce, Lislique, Nueva Esparta, Pasaquina, Polorós, San José, Santa Rosa de Lima
  { dep: '14', muni: '19', codes: ['01','02','03','06','09','11','12','13','15','16'] },
  // Sur (20): Conchagua, El Carmen, Intipucá, La Unión, Meanguera del Golfo, San Alejo, Yayantique, Yucuaiquín
  { dep: '14', muni: '20', codes: ['04','05','07','08','10','14','17','18'] }
];
