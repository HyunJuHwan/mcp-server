// import { MCPTool } from "mcp-framework";
// import { z } from "zod";

// interface SplitscenarioInput {
//   scenario_text: string;
// }

// class SplitscenarioTool extends MCPTool<SplitscenarioInput> {
//   name = "splitScenario";
//   description = "Splitscenario tool description";

//   schema = {
//     scenario_text: {
//       type: z.string(),
//       description: "scenario_text to process",
//     },
//   };

//   async execute({scenario_text}: SplitscenarioInput) {
//     const sentences = scenario_text
//       .split(/[.!?]/)
//       .map(s => s.trim())
//       .filter(Boolean);

//     const scenes = sentences.map((desc, i) => ({
//       scene_id: `scene-${i + 1}`,
//       description: desc
//     })); 
//     // saveScenes(scenes); // 캐시에 저장
//     return { scenes };
//   }
// }

// export default SplitscenarioTool;