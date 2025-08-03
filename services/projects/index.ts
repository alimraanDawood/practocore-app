import Pocketbase from 'pocketbase';
const SERVER_URL = "https://www.practocore.com";
// const SERVER_URL = "https://www.practocore.com";

const pocketbase = new Pocketbase(SERVER_URL);

export async function getProjects(page : number, numPerPage: number) {
    let projects = await pocketbase.collection('Projects').getList(page, numPerPage);
    const li = [];
    for(let project of projects.items) {
        const projectMilestones = await pocketbase.collection('Milestones').getFullList({ filter: `project = '${project.id}'` });
        li.push({ ...project, milestones: projectMilestones || [] });
    }


    return { ...projects, items: li };
}
