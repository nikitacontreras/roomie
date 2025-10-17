/* Auto-generated from original JS */
export const specs = {
    nds:{
        unitcode:{
            "0":"nds",
            "1": "nds/dsi",
            "2": "dsi"
        }
    },
    gb:{
        "a":""
    },
    sfc: {
        hardware: {
            "0": { coprocessor: false, rom: true },
            "1": { coprocessor: false, rom: true, ram: true },
            "2": { coprocessor: false, rom: true, ram: true, battery: true },
            "3": { coprocessor: "dsp", rom: true },
            "4": { coprocessor: "dsp", rom: true, ram: true },
            "5": { coprocessor: "dsp", rom: true, ram: true, battery: true },
            "6": { coprocessor: "dsp", rom: true, battery: true },
            "13": { coprocessor: "gsu/superFX", rom: true },
            "14": { coprocessor: "gsu/superFX", rom: true, ram: true },
            "15": { coprocessor: "gsu/superFX", rom: true, ram: true, battery: true },
            "16": { coprocessor: "gsu/superFX", rom: true, battery: true },
            "23": { coprocessor: "obc1", rom: true },
            "24": { coprocessor: "obc1", rom: true, ram: true },
            "25": { coprocessor: "obc1", rom: true, ram: true, battery: true },
            "26": { coprocessor: "obc1", rom: true, battery: true },
            "33": { coprocessor: "sa-1", rom: true },
            "34": { coprocessor: "sa-1", rom: true, ram: true },
            "35": { coprocessor: "sa-1", rom: true, ram: true, battery: true },
            "36": { coprocessor: "sa-1", rom: true, battery: true },
            "43": { coprocessor: "s-dd1", rom: true },
            "44": { coprocessor: "s-dd1", rom: true, ram: true },
            "45": { coprocessor: "s-dd1", rom: true, ram: true, battery: true },
            "46": { coprocessor: "s-dd1", rom: true, battery: true },
            "53": { coprocessor: "s-rtc", rom: true },
            "54": { coprocessor: "s-rtc", rom: true, ram: true },
            "55": { coprocessor: "s-rtc", rom: true, ram: true, battery: true },
            "56": { coprocessor: "s-rtc", rom: true, battery: true },
            "e3": { coprocessor: "other", rom: true },
            "e4": { coprocessor: "other", rom: true, ram: true },
            "e5": { coprocessor: "other", rom: true, ram: true, battery: true },
            "e6": { coprocessor: "other", rom: true, battery: true },
            "f3": { coprocessor: "custom", rom: true },
            "f4": { coprocessor: "custom", rom: true, ram: true },
            "f5": { coprocessor: "custom", rom: true, ram: true, battery: true },
            "f6": { coprocessor: "custom", rom: true, battery: true },
        },
        romspeed: {
            "20": { type: "LoROM", speed: "2.68MHz" },
            "21": { type: "HiROM", speed: "2.68MHz" },
            "23": { type: "SA-1"},
            "25": { type: "ExHiROM", speed: "2.68MHz" },
            "30": { type: "LoROM", speed: "3.58MHz" },
            "31": { type: "HiROM", speed: "3.58MHz" },
            "32": { type: "ExHiROM", speed: "3.58MHz" },
        }
    }
} as const;
export type SupportedSystemsForSpecs = keyof typeof specs;
