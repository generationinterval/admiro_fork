type StrMap = Record<string, string>;

const invert = (m: StrMap): StrMap =>
    Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k])) as StrMap;

// ---- Column keys (short <-> long) ----
const toShort: StrMap = {
    "Chromosome": "chrom",
    "Phase state": "phase_state",
    "Ancestry": "anc",
    "Haplotype": "hap",
    "Mean Length (bp)": "len_mea",
    "Median Length (bp)": "len_med",
    "Max Length (bp)": "len_max",
    "Min Length (bp)": "len_min",
    "N Fragments": "nfr",
    "Sequence (bp)": "seq",
    "Sex": "sex",
    "Region": "reg",
    "Dataset": "dat",
    "Population": "pop",
    "Anc Africa": "ancAFR",
    "Anc America": "ancAMR",
    "Anc East Asia": "ancEAS",
    "Anc Europe": "ancEUR",
    "Anc Oceania": "ancOCE",
    "Anc Oceania 2": "ancOCE2",
    "Anc South Asia": "ancSAS",
    "Anc Middle East": "ancMID",
    "Individual": "ind",
    "Individual phase": "ind_phase",
    "Latitude": "lat",
    "Longitude": "lon",
    "Mean Post. Prob.": "mpp",
};

const toLong: StrMap = invert(toShort);

// ---- Value maps ----
const ancToShort: StrMap = {
    "All": "All",
    "Ambiguous": "Ambiguous",
    "Denisova": "Denisova",
    "Neanderthal": "Neanderthal",
    "Altai": "Altai",
    "Vindija": "Vindija",
    "Chagyrskaya": "Chagyrskaya",
    "AmbigNean": "AmbigNean",
    "Non DAVC": "nonDAVC",
};
const ancToLong = invert(ancToShort);

const regToShort: StrMap = {
    "Europe": "EUR",
    "Middle East": "MID",
    "South Asia": "SAS",
    "Africa": "AFR",
    "East Asia": "EAS",
    "America": "AMR",
    "Oceania": "OCE",
    "Central Asia": "CAS",
};
const regToLong = invert(regToShort);

const chromToShort: StrMap = {
    "Autosome": "A",
    "X Chromosome": "X",
};
const chromToLong = invert(chromToShort);

const phaseToShort: StrMap = {
    "Unphased": "unphased",
    "Phased": "phased",
};
const phaseToLong = invert(phaseToShort);

export const mapping = {
    toShort,
    toLong,
    values: {
        anc: { toShort: ancToShort, toLong: ancToLong },
        reg: { toShort: regToShort, toLong: regToLong },
        chrom: { toShort: chromToShort, toLong: chromToLong },
        phase_state: { toShort: phaseToShort, toLong: phaseToLong },
    },
} as const;
