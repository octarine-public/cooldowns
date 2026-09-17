/**
 * The stage of the cooldowns page, showing the unit the strips are dressed against.
 *
 * Everything but the turn is the stage's own: the lamps, the room and the framing that comes with
 * a scene put the subject in the lower two thirds of the card with its head at the line the
 * health bar is drawn on — which is the line this page hangs everything else off. A stage that
 * framed its subject itself would have to keep that agreement by hand, and lose it the first time
 * either side of it moved.
 *
 * The turn is ours because Dota is not shot from the front. A model is authored facing the
 * camera, and a body seen dead-on is a body with no depth: a courier head-on is a nose, a spirit
 * bear head-on is a brown wall. Three eighths of a right angle is enough to give every one of
 * them a side without costing it its face.
 */
export const PreviewScene = new MenuSDK.CPreviewScene()

PreviewScene.SetModelAngles(0, 35)

/**
 * The room the card keeps for itself, and the subject fills what is left.
 *
 * The band down the top of the stage is where the health bar is drawn and everything on the page
 * is docked to it, so it is the one measurement this page knows and the stage does not. What size
 * that leaves is the other way round: it is a property of the subject, and a hero, a courier and
 * Roshan are three different shapes. Saying the room and letting the stage size the subject is
 * what stands each of them as large as it goes without any of them growing into the bar.
 */
PreviewScene.SetFraming({
	fit: { top: 0.38, bottom: 0.06, sides: 0.08 }
})

/** How many garments the stage has raised, so the ones a barer unit does not wear come off. */
let worn = 0

/**
 * Dresses the subject in what it wears this frame.
 *
 * Each garment is worn on the subject's skeleton rather than hung off one of its bones, which is
 * what a Dota wearable is: it is skinned to the hero's own rig and carries none of his
 * animations, so every bone the two share is driven by his and the rest follow the body.
 *
 * Called every frame, since a spec that says what the stage already shows does nothing, and the
 * ids are the slots rather than the models — a unit wearing fewer garments than the last takes
 * the spare ones off instead of leaving them standing on an empty stage.
 */
export function DressPreview(models: readonly string[]): void {
	for (let index = 0; index < models.length; index++) {
		PreviewScene.AddModel(`worn-${index}`, { model: models[index], merge: true })
	}
	for (let index = models.length; index < worn; index++) {
		PreviewScene.RemoveModel(`worn-${index}`)
	}
	worn = models.length
}
