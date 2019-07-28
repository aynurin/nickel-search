
import spawn from "./spawn";

export default class DockerApi {
    public async build(dockerfile: string, tagname: string) {
        await spawn("docker", [
            "build",
            ".",
            "--file",
            dockerfile,
            "--tag=" + tagname]);
    }

    public async login(username: string, password: string, registryEndpoint: string) {
        console.log("Docker login...");
        await spawn("docker", [
            "login",
            "-u", username,
            "-p", password,
            registryEndpoint]);
    }

    public async tag(tagname: string, fullname: string) {
        console.log("Docker tag...");
        await spawn("docker", [
            "tag", tagname, fullname]);
    }

    public async push(fullname: string) {
        console.log("Docker push...");
        await spawn("docker", [
            "push", fullname]);
    }
}
