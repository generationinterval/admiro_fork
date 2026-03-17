export interface FilterState {
  phases: string[];
  var_1: string;
  data_1: string[];
  reg_1: string[];
  mpp_1: number;
  chrms_1: string[];
  ancs_1: string[];
  var_2_1: string;
  var_2_2: string;
  col: string[];
  fac_x: string[];
  fac_y: string[];
  mea_med_1: boolean;
  mea_med_x: boolean;
  mea_med_y: boolean;
  plot: string;
  n_bins: number;
  x_axis: string;
  min_x_axis: number;
  max_x_axis: number;
  y_axis: string;
  min_y_axis: number;
  max_y_axis: number;
  map_data: boolean;
  map_data_rad: number;
  map_reg: boolean;
  map_reg_rad: number;
  map_pop: boolean;
  map_pop_rad: number;
  map_ind_rad: number;
  map_lat_jit: number;
  map_lon_jit: number;
  tree_lin: string[];
  bandwidth_divisor: number;
  thresholds: number;
}
export const mppMarks = [
  { value: 0.5, label: "50%" },
  { value: 0.55, label: "" },
  { value: 0.6, label: "" },
  { value: 0.65, label: "65%" },
  { value: 0.7, label: "" },
  { value: 0.75, label: "" },
  { value: 0.8, label: "80%" },
  { value: 0.85, label: "" },
  { value: 0.9, label: "" },
  { value: 0.95, label: "95%" },
];

export const optionsAxis = ["Free Axis", "Shared Axis", "Define Range"]
export const mapJitMarks = [
  { value: 0, label: "0" },
  { value: 1, label: "" },
  { value: 2, label: "" },
  { value: 3, label: "" },
  { value: 4, label: "" },
  { value: 5, label: "5" },
  { value: 6, label: "" },
  { value: 7, label: "" },
  { value: 8, label: "" },
  { value: 9, label: "" },
  { value: 10, label: "10" },
];



export const datasets = {
  options_old: [
    "DATA",
    "PDAT",
    "GNOM",
    "PGNO",
    "GENI",
    "PGEN",
    "1KGP",
    "HGDP",
    "SGDP",
    "VANU",
    "IGDP",
    "AYTA",
    "OFAR",
  ],
  options: [
    "Unphased",
    "Phased",
  ],
};

export const mappingToShort = {
  Autosome: "A",
  X: "X",
  "X Prime": "Xprime",
  All: "All",
  Ambiguous: "Ambiguous",
  Denisova: "Denisova",
  Neanderthal: "Neanderthal",
  Altai: "Altai",
  Vindija: "Vindija",
  Chagyrskaya: "Chagyrskaya",
  AmbigNean: "AmbigNean",
  "Non DAVC": "nonDAVC",
  Individual: "ind",
  Sex: "sex",
  Population: "pop",
  Region: "reg",
  Dataset: "dat",
  "Original dataset": "oda",
  Time: "tim",
  Latitude: "lat",
  Longitude: "lon",
  Chromosome: "chrom",
  Ancestry: "anc",
  "Mean Length (bp)": "len_mea",
  "Median Length (bp)": "len_med",
  "Max Length (bp)": "len_max",
  "Min Length (bp)": "len_min",
  "N Fragments": "nfr",
  "Sequence (bp)": "seq",
  "Anc Africa": "ancAFR",
  "Anc America": "ancAMR",
  "Anc East Asia": "ancEAS",
  "Anc Europe": "ancEUR",
  "Anc Oceania": "ancOCE",
  "Anc South Asia": "ancSAS",
  DATA: "DATA",
  PDAT: "PDAT",
  GNOM: "GNOM",
  PGNO: "PGNO",
  GENI: "GENI",
  PGEN: "PGEN",
  "1KGP": "1KGP",
  HGDP: "HGDP",
  SGDP: "SGDP",
  VANU: "VANU",
  IGDP: "IGDP",
  AYTA: "AYTA",
  OFAR: "OFAR",
  Europe: "EUR",
  "Middle East": "MID",
  "South Asia": "SAS",
  Africa: "AFR",
  "East Asia": "EAS",
  America: "AMR",
  Oceania: "OCE",
  "Central Asia": "CAS",
  Global: "GLOB",
  Joined: "joined",
  Frequency: "freq",
  Shared: "shared",
  Private: "private",
  Haploidy: "hap",
  Start: "start",
  End: "end",
  Length: "length",
  SNPs: "snps",
  "Mean Post. Prob.": "mean_prob",
  "Admix. Pop. Variants": "arc",
  "Phased": "PDAT",
  "Diploid": "DATA",
}

export const mappingToLong = {
  EUR: "Europe",
  MID: "Middle East",
  SAS: "South Asia",
  AFR: "Africa",
  EAS: "East Asia",
  AMR: "America",
  OCE: "Oceania",
  CAS: "Central Asia",
  GLOB: "Global",
  DATA: "Diploid",
  PDAT: "Phased",
  A: "Autosome",
  X: "X",
  Xprime: "X Prime",
  F: "Female",
  M: "Male",
  All: "All",
  Ambiguous: "Ambiguous",
  den: "Denisova",
  Neanderthal: "Neanderthal",
  alt: "Altai",
  vin: "Vindija",
  cha: "Chagyrskaya",
  AmbigNean: "AmbigNean",
  nonDAVC: "Non DAVC",
}



export const optionsContinuousShort = ["tim",
  "lat",
  "lon",
  "len_mea",
  "len_med",
  "len_max",
  "len_min",
  "nfr",
  "seq",
  "ancAFR",
  "ancAMR",
  "ancEAS",
  "ancEUR",
  "ancOCE",
  "ancSAS",]


export const optionsChromosome = ["Autosome", "X", "X Prime"]

export const optionsAncestry = [
  "All",
  "Ambiguous",
  "Denisova",
  "Neanderthal",
  "Altai",
  "Vindija",
  "Chagyrskaya",
  "AmbigNean",
  "Non DAVC",
]

export const optionsRegion = [
  "Europe",
  "Middle East",
  "South Asia",
  "Africa",
  "East Asia",
  "America",
  "Oceania",
  "Central Asia",
]

export const binMarks = [
  { value: 0, label: "0" },
  { value: 25, label: "25" },
  { value: 50, label: "50" },
  { value: 75, label: "75" },
  { value: 100, label: "100" },
];

export const bandwidthDivisorMarks = [
  { value: 1, label: "Dense" },
  { value: 100, label: "Light" },
];

export const tdBandwidthDivisorMarks = [
  { value: 1, label: "Detailed" },
  { value: 50, label: "Smooth" },
];


export const tdThresholdDivisorMarks = [
  { value: 10, label: "Less" },
  { value: 45, label: "More" },
];

export const phases = {
  options: [
    "Unphased",
    "Phased",
  ]
}
export const variables = {
  allOptions: [
    "Chromosome",
    "Phase state",
    "Ancestry",
    "Haplotype",
    "Mean Length (bp)",
    "Median Length (bp)",
    "Max Length (bp)",
    "Min Length (bp)",
    "N Fragments",
    "Sequence (bp)",
    "Sex",
    "Region",
    "Dataset",
    "Population",
    "Anc Africa",
    "Anc America",
    "Anc East Asia",
    "Anc Europe",
    "Anc Oceania",
    "Anc Oceania 2",
    "Anc South Asia",
    "Anc Middle East",
  ],
  discreteOptions: [
    "Chromosome",
    "Phase state",
    "Ancestry",
    "Haplotype",
    "Sex",
    "Region",
    "Dataset",
    "Population",
  ],
  continousOptions: [
    "Mean Length (bp)",
    "Median Length (bp)",
    "Max Length (bp)",
    "Min Length (bp)",
    "N Fragments",
    "Sequence (bp)", "Anc Africa",
    "Anc America",
    "Anc East Asia",
    "Anc Europe",
    "Anc Oceania",
    "Anc Oceania 2",
    "Anc South Asia",
    "Anc Middle East",
  ]
}

export const ancestries = {
  options: [
    "All",
    "Ambiguous",
    "Denisova",
    "Neanderthal",
    "Altai",
    "Vindija",
    "Chagyrskaya",
    "AmbigNean",
    "Non DAVC",
  ]
}

export const chromosomes = {
  options: [
    "Autosomes",
    "X Chromosome",
  ]
}

export const regions = {
  options: [
    "Europe",
    "Middle East",
    "South Asia",
    "Africa",
    "East Asia",
    "America",
    "Oceania",
    "Central Asia"
  ]
}
