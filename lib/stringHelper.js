module.exports = () => {
    String.prototype.hexEncode = function () {
        var hex, i;

        var result = "";
        for (i = 0; i < this.length; i++) {
            hex = this.charCodeAt(i).toString(16);
            result += ("000" + hex).slice(-4);
        }

        return result
    }
}