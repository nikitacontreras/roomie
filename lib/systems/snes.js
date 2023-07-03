const fs = require("fs")

module.exports = {
    isHiRom: (path) => {
        return fs.statSync(path).size % fs.readFileSync(path)[0x400] === 0 ? 1 : 0
    },
    name: (file) => {
        this.isHiRom()
    }
}