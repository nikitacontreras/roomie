const { createHash } = require("cryptography");
const { EventEmitter } = require('events');
const { regions } = require("./regions")
const { specs } = require("./specs")
const { stringHelper } = require("./stringHelper")
const fs = require('fs');

let rom, system;

class Roomie extends EventEmitter {
    constructor(path) {
        super()
        this.load(path)
        this.__rom, this.__system
        this.name = this._name()
        this.gameid = this._gameid()
        this.region = this._region()
        this.gamecode = this._gamecode()
        this.cartridge = this._cartridge()
    }
    get system() {
        return this.__system
    }
    set system(extension) {
        this.__system = extension
    }
    get rom() {
        return this.__rom
    }
    set rom(buffer) {
        this.__rom = buffer
    }

    load = (path) => {
        this.__rom = fs.readFileSync(path)
        this.__system = path.split(".")[path.split().length]
    }

    _name() {
        switch (this.system) {
            case "nds":
                return this.rom.slice(0x0, 0xB).toString().trim()
            case "gba":
                return this.rom.slice(0xA0, 0xA0 + 12).toString().trim()
            case "gb":
                return this.rom.slice(0x134, 0x134 + 9).toString().trim()
            case "sfc":
                return this.rom.slice(0xFFC0, 0xFFC0 + 21).toString().trim()
            case "n64":
                return this.rom.slice(0x20, 0x20 + 14).toString().match(/.{1,2}/g).reverse().join('').split("").reverse().join("").trim()
        }
    }

    _gamecode() {
        switch (this.system) {
            case "nds":
                return this.rom.slice(0xD, 0xD + 2).toString()
            case "gba":
                return this.rom.slice(0xAD, 0xAD + 2).toString()
            case "sfc":
                return this.rom.slice(0xFFB2, 0xFFB2 + 4).toString("ASCII")
        }
    }

    _gameid() {
        switch (this.system) {
            case "nds":
                return "NTR-" + this.rom.slice(0xC, 0xC + 4).toString()
            case "gba":
                return "AGB-" + this.rom.slice(0xAC, 0xAC + 4).toString()
        }
    }

    _cartridge() {
        switch (this.system) {
            case "nds":
                return {
                    unit: specs.nds.unitcode[this.rom[0x012].toString(16)],
                    developer: this.rom[0x012].toString(16),
                    version: this.rom[0x01E],
                    title: this.rom.slice(0x265440, 0x265440+0x3B).toString().replace(/\x00/g, '').replace(/(\\n)/g, "\n")
                }
            case "sfc":
                return {
                    romSpeed: this.rom[0xFFD9],
                    rom: {
                        size: 2 ** (2 ^ (this.rom[0xFFD7])) * 1000,
                        specs: specs.sfc.romspeed[this.rom[0xFFD5].toString(16)]
                    },
                    ram: 2 ** (2 ^ (this.rom[0xFFD8])) * 1000,
                    hardware: specs.sfc.hardware[this.rom[0xFFD6].toString(16)],
                }
        }
    }

    _region() {
        switch (this.system) {
            case "nds":
                return regions.nds[(this.gameid[this.gameid.length - 1])]
            case "gba":
                return regions.gba[(this.gameid[this.gameid.length - 1])]
            case "gb":
                return regions.gb[this.rom[0x14A].toString()]
            case "sfc":
                return regions.snes[this.rom[0xFFD9].toString()]
        }
    }
}

module.exports = Roomie