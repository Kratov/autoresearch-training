# Model Testing Prompts

Test prompts for your Shakespeare-trained GPT model. Copy these into the **Context/Prefix** or **Prompt** fields.

---

## Character Dialogues

### Romeo
```
ROMEO:
```

### Juliet
```
JULIET:
O Romeo, Romeo! wherefore art thou Romeo?
```

### Hamlet
```
HAMLET:
To be, or not to be, that is the question:
```

### Macbeth
```
MACBETH:
Is this a dagger which I see before me,
```

### Lady Macbeth
```
LADY MACBETH:
Out, damned spot! out, I say!
```

---

## Scene Setups

### Balcony Scene
```
ACT II. SCENE II. Capulet's orchard.

Enter ROMEO.

ROMEO:
But, soft! what light through yonder window breaks?
```

### Witches Scene
```
Thunder. Enter the three Witches.

First Witch:
When shall we three meet again?
In thunder, lightning, or in rain?

Second Witch:
```

### Court Scene
```
A room of state in the palace.

Enter KING, QUEEN, and Attendants.

KING:
```

### Battle Scene
```
Alarum. Enter KING RICHARD and RICHMOND; they fight.

KING RICHARD:
```

---

## Sonnets

### Sonnet Opening
```
SONNET

Shall I compare thee to a summer's day?
Thou art more lovely and more temperate:
```

### Love Sonnet
```
SONNET

When in disgrace with fortune and men's eyes,
I all alone beweep my outcast state,
```

### New Sonnet Start
```
SONNET

```

---

## Monologues

### Contemplative
```
Enter HAMLET, alone.

HAMLET:
What a piece of work is man!
```

### Villainous
```
IAGO:
Thus do I ever make my fool my purse:
```

### Romantic
```
ROMEO:
She speaks:
O, speak again, bright angel! for thou art
```

---

## Multi-Character Dialogue

### Argument
```
CAPULET:
How now, how now, chop-logic! What is this?

JULIET:
Good father, I beseech you on my knees,

CAPULET:
```

### Comedy
```
BOTTOM:
I see their knavery: this is to make an ass of me;

QUINCE:
```

### Royal Court
```
KING:
Now is the winter of our discontent
Made glorious summer by this sun of York;

GLOUCESTER:
```

---

## Testing Tips

### Temperature Guide
| Temperature | Result |
|-------------|--------|
| 0.3 - 0.5 | More coherent, may repeat phrases |
| 0.7 - 0.8 | Balanced (recommended) |
| 1.0 - 1.2 | More creative, may be nonsensical |

### Max Tokens Guide
| Tokens | Good For |
|--------|----------|
| 100 | Short responses, single speech |
| 200 | Medium dialogue |
| 300-500 | Full scene generation |

### Best Practices
1. **End with a colon or newline** - Signals the model to continue
2. **Use ALL CAPS for names** - Matches training data format
3. **Include stage directions** - Helps set the scene
4. **Start mid-sentence** - Model completes naturally

---

## Quick Test Sequence

Use these in order to evaluate your model:

1. **Basic completion** - Just `ROMEO:\n` with temp 0.8
2. **Style consistency** - Sonnet opening, check if it continues in verse
3. **Character voice** - Compare HAMLET vs FALSTAFF outputs
4. **Creativity** - Same prompt at temp 0.5 vs 1.0
5. **Length handling** - Generate 100 vs 500 tokens

---

## Demo Script

For a live demo, use this sequence:

1. Show "No Model" state
2. Start training, watch loss decrease
3. Wait for completion
4. Click "Romeo & Juliet" preset
5. Generate with default settings
6. Adjust temperature, regenerate
7. Try custom prompt
