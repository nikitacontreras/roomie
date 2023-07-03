const { createHash } = require("cryptography");
const { EventEmitter } = require('events');
const { regions } = require("./regions")
const { specs } = require("./specs")
const { stringHelper } = require("./stringHelper")
const fs = require('fs');
const { systems } = require('./system')

let rom, system;

class Roomie extends EventEmitter {
    constructor(path) {
        super()
        this.load(path)

        this.__rom, this.__system, this.__romInfo, this.__path
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
        this.__path = path
        this.__rom = fs.readFileSync(path)
        this.__romInfo = fs.statSync(path)
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
                return (systems.snes.isHiRom(this.__path) ? this.rom.slice(0xFFC0, 0xFFC0 + 21) : this.rom.slice(0x7FC0, 0x7FC0 + 21)).toString().trim()
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
                return (systems.snes.isHiRom(this.__path) ? this.rom.slice(0xFFB2, 0xFFB2 + 4) : this.rom.slice(0x7FB2, 0x7FB2 + 4)).toString("ASCII").trim()
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
                    title: this.rom.slice(0x265440, 0x265440 + 0x3B).toString().replace(/\x00/g, '').replace(/(\\n)/g, "\n")
                }
            case "gba":
                return {
                    developer: this.rom.slice(0xB0, 0xB0 + 0x2).toString()
                }
            case "gb":
                return {
                    rom: {
                        size: this.rom[0x148]
                    }
                }
            case "sfc":
                return {
                    romSpeed: (systems.snes.isHiRom(this.__path) ? this.rom[0xFFD9] : this.rom[0x7FD9]).toString().trim(),
                    rom: {
                        size: 2 ** (2 ^ (systems.snes.isHiRom(this.__path) ? this.rom[0xFFD7] : this.rom[0x7FD7])) * 1000,
                        specs: specs.sfc.romspeed[(systems.snes.isHiRom(this.__path) ? this.rom[0xFFD5] : this.rom[0x7FD5]).toString(16)]
                    },
                    ram: 2 ** (2 ^ ((systems.snes.isHiRom(this.__path) ? this.rom[0xFFD8] : this.rom[0x7FD8]))) * 1000,
                    hardware: specs.sfc.hardware[(systems.snes.isHiRom(this.__path) ? this.rom[0xFFD6] : this.rom[0x7FD6]).toString(16)],
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
                return regions.snes[(systems.snes.isHiRom(this.__path) ? this.rom[0xFFD9] : this.rom[0x7FD9]).toString()]
        }
    }
}

module.exports = Roomie