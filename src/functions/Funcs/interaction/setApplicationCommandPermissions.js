const { ApplicationCommandPermissionType } = require("discord.js");

module.exports = async (d) => {
    const data = d.util.aoiFunc(d);
    if (data.err) return d.error(data.err);

    const [guildID = "global", id, ...perms] = data.inside.splits;

    let permissions = [];
    if (perms.length === 1) {
        try {
            permissions = JSON.parse(perms);
        } catch {
            const e = perms[0].split(":");
            permissions.push({
                id: e[0],
                type: ApplicationCommandPermissionType[e[1]],
                permission: e[2] === "true",
            });
        }
    } else {
        const e = perms[0].split(":");
        permissions.push({
            id: e[0],
            type: ApplicationCommandPermissionType[e[1]],
            permission: e[2] === "true",
        });
    }

    if (guildID == "global") {
        d.client.application.commands.permissions.set({
            command: id,
            token: d.client.token,
            permissions,
        });
    } else {
        d.client.application.commands.permissions.set({
            guild: guildID,
            command: id,
            token: d.client.token,
            permissions,
        });
    }

    return {
        code: d.util.setCode(data),
    };
};
