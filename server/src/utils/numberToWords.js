const UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ',
    'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE'
];

const DECENAS = ['', '', 'VEINTI', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];

const CIENTOS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS',
    'OCHOCIENTOS', 'NOVECIENTOS'
];

const convertirGrupo = (n) => {
    if (n === 0) return '';
    if (n < 21) return UNIDADES[n];
    if (n < 30) return n === 20 ? 'VEINTE' : `VEINTI${UNIDADES[n - 20]}`;
    if (n < 100) {
        const d = Math.floor(n / 10);
        const u = n % 10;
        return u === 0 ? DECENAS[d] : `${DECENAS[d]} Y ${UNIDADES[u]}`;
    }
    if (n < 1000) {
        const c = Math.floor(n / 100);
        const resto = n % 100;
        if (n === 100) return 'CIEN';
        return resto === 0 ? CIENTOS[c] : `${CIENTOS[c]} ${convertirGrupo(resto)}`;
    }
    return '';
};

const numeroALetras = (num) => {
    if (num === 0) return 'CERO';
    if (num >= 1000000) {
        const millones = Math.floor(num / 1000000);
        const resto = num % 1000000;
        const millonesStr = millones === 1 ? 'UN MILLON' : `${convertirGrupo(millones)} MILLONES`;
        return resto === 0 ? millonesStr : `${millonesStr} ${numeroALetras(resto)}`;
    }
    if (num >= 1000) {
        const miles = Math.floor(num / 1000);
        const resto = num % 1000;
        const milesStr = miles === 1 ? 'MIL' : `${convertirGrupo(miles)} MIL`;
        return resto === 0 ? milesStr : `${milesStr} ${convertirGrupo(resto)}`;
    }
    return convertirGrupo(num);
};

const numberToWords = (amount) => {
    const entero = Math.floor(amount);
    const decimal = Math.round((amount - entero) * 100);
    const letras = numeroALetras(entero);
    return `${letras} CON ${String(decimal).padStart(2, '0')}/100 DOLARES DE LOS ESTADOS UNIDOS DE AMERICA`;
};

module.exports = { numberToWords, numeroALetras };
